<?php
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$root = realpath(__DIR__ . '/../frontend');
if (!str_starts_with($path, '/api/')) {
    $file = realpath($root . ($path === '/' ? '/index.html' : rawurldecode($path)));
    if (!$file || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file)) { http_response_code(404); echo 'Archivo no encontrado'; return; }
    if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'])) { http_response_code(405); return; }
    $types = ['html'=>'text/html','js'=>'text/javascript','css'=>'text/css','svg'=>'image/svg+xml'];
    header('Content-Type: ' . ($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream') . '; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') readfile($file);
    return;
}
require __DIR__ . '/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$nativeConfigForm = $path === '/api/config' && str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/x-www-form-urlencoded');
try {
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET','POST'])) { http_response_code(405); echo json_encode(['error'=>'Metodo no permitido.']); return; }
    if (!in_array($path, ['/api/state','/api/command','/api/health','/api/config'])) { http_response_code(404); echo json_encode(['error'=>'Ruta no encontrada.']); return; }
    if ($path === '/api/config') {
        if ($method === 'GET') { echo json_encode(['managed'=>managedConnection()]); return; }
        if (managedConnection()) { http_response_code(409); echo json_encode(['error'=>'La conexion se configura automaticamente en esta instalacion. Abre el inicio del sistema.']); return; }
        if ($method !== 'POST') { http_response_code(405); echo json_encode(['error'=>'Metodo no permitido.']); return; }
        if (!$nativeConfigForm && !str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) throw new InvalidArgumentException('Se requiere JSON.');
        if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] !== 'http://' . $_SERVER['HTTP_HOST']) throw new InvalidArgumentException('Origen no permitido.');
        if ($nativeConfigForm && ($_SERVER['HTTP_ORIGIN'] ?? '') !== 'http://' . $_SERVER['HTTP_HOST']) throw new InvalidArgumentException('Abre el formulario desde este servidor e intenta de nuevo.');
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 4096) throw new InvalidArgumentException('Solicitud demasiado grande.');
        $candidate = $nativeConfigForm ? $_POST : json_decode(file_get_contents('php://input'), true, 16, JSON_THROW_ON_ERROR);
        foreach (['port','database','user','password'] as $field) if (!isset($candidate[$field]) || !is_scalar($candidate[$field])) throw new InvalidArgumentException('Completa la configuracion.');
        if (!ctype_digit((string)$candidate['port']) || (int)$candidate['port'] < 1 || (int)$candidate['port'] > 65535) throw new InvalidArgumentException('Puerto no valido.');
        if (!preg_match('/^[a-zA-Z0-9_]{1,63}$/D', $candidate['database']) || !preg_match('/^[a-zA-Z0-9_]{1,63}$/D', $candidate['user'])) throw new InvalidArgumentException('Nombre de base o usuario no valido.');
        $db = database($candidate);
        foreach (TABLE_KEYS as $table => $key) {
            $stmt = $db->prepare('SELECT to_regclass(?)'); $stmt->execute(['public.' . $table]);
            if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Falta la tabla ' . $table . ' en esta base. No se ha modificado su estructura.');
        }
        $routines = ['sp_registrar_separacion','sp_liberar_separacion_vencida','sp_concretar_separacion','sp_modificar_nota_venta','sp_insertar_cliente','sp_insertar_lote'];
        foreach ($routines as $routine) {
            $stmt = $db->prepare("SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=? AND p.prokind='p'"); $stmt->execute([$routine]);
            if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Falta el procedimiento ' . $routine . '. Revisa las rutinas instaladas en esta base.');
        }
        $db->beginTransaction(); $db->exec('SET TRANSACTION READ ONLY'); snapshot($db); $db->commit();
        $encoded = json_encode(array_intersect_key($candidate, array_flip(['port','database','user','password'])), JSON_THROW_ON_ERROR);
        $temp = configPath() . '.tmp';
        if (file_put_contents($temp, $encoded, LOCK_EX) === false || !rename($temp, configPath())) throw new RuntimeException('No se pudo guardar la conexion.');
        if ($nativeConfigForm) { header('Location: /#/inicio', true, 303); return; }
        echo json_encode(['ok'=>true,'database'=>$candidate['database']]); return;
    }
    $db = database();
    if ($path === '/api/health' && $method === 'GET') { $db->query('SELECT 1 FROM public.cliente LIMIT 1'); echo json_encode(['ok'=>true,'database'=>'PostgreSQL','managed'=>managedConnection()]); return; }
    if (($path === '/api/command') !== ($method === 'POST')) { http_response_code(405); echo json_encode(['error'=>'Metodo no permitido.']); return; }
    $db->beginTransaction();
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $result = null;
    if ($method === 'POST') {
        // JSON and same-origin requests prevent form-based cross-site mutations.
        if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) throw new InvalidArgumentException('Se requiere JSON.');
        if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] !== 'http://' . $_SERVER['HTTP_HOST']) throw new InvalidArgumentException('Origen no permitido.');
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) throw new InvalidArgumentException('Solicitud demasiado grande.');
        $body = json_decode(file_get_contents('php://input'), true, 32, JSON_THROW_ON_ERROR);
        $op = $body['operation'] ?? '';
        $args = $body['args'] ?? [];
        if (!is_array($args) || !array_is_list($args)) throw new InvalidArgumentException('Parametros no validos.');
        switch ($op) {
            case 'save':
                [$table, $values, $original] = array_pad($args, 3, null);
                $fields = ['cliente'=>['dni_cliente','direccion','nombres','apellidos'], 'asesor'=>['dni_asesor','nombres','apellidos'], 'proyecto'=>['nombre_proyecto','ciudad_proyecto','distrito_proyecto'], 'lote'=>['nombre_proyecto','numero_lote','calle','manzana','tipo_ubicacion','precio_metro','area'], 'ciudad_proyecto'=>['descripcion'], 'distrito_proyecto'=>['descripcion']];
                if (!is_string($table) || !isset($fields[$table]) || !is_array($values)) throw new InvalidArgumentException('Registro no valido.');
                $params = [];
                foreach ($fields[$table] as $field) {
                    $value = $values[$field] ?? null;
                    if (!is_scalar($value) || trim((string)$value) === '') throw new InvalidArgumentException('Completa todos los campos obligatorios.');
                    $params[] = trim((string)$value);
                }
                $key = TABLE_KEYS[$table];
                if ($original !== null) {
                    if (isset($values[$key]) && (string)$values[$key] !== (string)$original) throw new InvalidArgumentException('El identificador no se puede modificar.');
                    if (in_array($table, ['lote','ciudad_proyecto','distrito_proyecto'])) array_unshift($params, $original);
                }
                callProcedure($db, 'sp_' . ($original === null ? 'insertar_' : 'modificar_') . $table, $params);
                $result = $original ?? ($values[$key] ?? (int)$db->query('SELECT lastval()')->fetchColumn());
                break;
            case 'remove':
                [$table, $key] = $args;
                if (!is_string($table) || !in_array($table, ['cliente','asesor','proyecto','lote','ciudad_proyecto','distrito_proyecto'])) throw new InvalidArgumentException('No se permite eliminar este registro.');
                callProcedure($db, 'sp_eliminar_' . $table, [$key]); break;
            case 'savePhone':
                [$dni, $phone, $old] = array_pad($args, 3, null);
                callProcedure($db, $old === null ? 'sp_insertar_telefono_cliente' : 'sp_modificar_telefono_cliente', $old === null ? [$dni,$phone] : [$dni,$old,$phone]); break;
            case 'removePhone': callProcedure($db, 'sp_eliminar_telefono_cliente', $args); break;
            case 'reserve':
                $v = $args[0];
                callProcedure($db, 'sp_registrar_separacion', [$v['serie_numero'] ?? null,$v['id_lote'] ?? null,$v['dni_cliente'] ?? null,$v['dni_asesor'] ?? null,$v['forma_pago'] ?? null,$v['descripcion'] ?? null]);
                $result = $v['serie_numero']; break;
            case 'changeReservation':
                [$lot, $action] = $args;
                if (!in_array($action, ['release','complete'])) throw new InvalidArgumentException('Accion no valida.');
                callProcedure($db, $action === 'release' ? 'sp_liberar_separacion_vencida' : 'sp_concretar_separacion', [$lot]); break;
            case 'updateNote':
                [$serie, $v] = $args;
                callProcedure($db, 'sp_modificar_nota_venta', [$serie,$v['forma_pago'] ?? null,$v['descripcion'] ?? null]); break;
            default: throw new InvalidArgumentException('Operacion no permitida.');
        }
    }
    $data = snapshot($db);
    $db->commit();
    echo json_encode(['result'=>$result,'data'=>$data], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    $code = $error instanceof PDOException ? (string)$error->getCode() : '';
    http_response_code($code === '40001' || $code === '23505' ? 409 : ($error instanceof InvalidArgumentException || $error instanceof JsonException || str_starts_with($code, '22') || str_starts_with($code, '23') || str_starts_with($code, 'P0') ? 422 : 503));
    $message = match ($code) {
        '23505' => 'Ya existe un registro con ese identificador o ubicacion.',
        '23503' => 'El registro tiene dependencias o una referencia ya no existe.',
        '23514','23502','22001','22P02','22003' => 'Revisa los campos, formatos y limites del registro.',
        '40001' => 'Otro usuario modifico estos datos. Actualiza la pantalla e intenta de nuevo.',
        'P0001','P0002','22023' => preg_replace('/\nCONTEXT:.*/s', '', preg_replace('/^.*ERROR:\s*/', '', $error->getMessage())),
        default => $error instanceof InvalidArgumentException ? $error->getMessage() : 'No se pudo completar la operacion. Revisa que la base de datos este disponible.'
    };
    error_log($error->getMessage());
    if ($nativeConfigForm) {
        header('Content-Type: text/html; charset=utf-8');
        $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>No se pudo conectar · Villa Horizonte</title><link rel="stylesheet" href="/css/styles.css"></head><body><main class="content" style="max-width:640px;margin:auto"><section class="card card-body"><h1>No se pudo conectar</h1><p role="alert">' . $safeMessage . '</p><p>Comprueba que PostgreSQL esté iniciado y revisa el puerto, usuario y contraseña de pgAdmin.</p><a class="btn primary" href="/conexion.html">Volver al formulario de conexión</a></section></main></body></html>';
        return;
    }
    echo json_encode(['error'=>$message], JSON_UNESCAPED_UNICODE);
}
