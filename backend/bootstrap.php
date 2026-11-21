<?php
declare(strict_types=1);
date_default_timezone_set('America/Lima');
function configPath(): string { return (getenv('APP_RUNTIME') ?: __DIR__ . '/../.runtime') . '/database.json'; }
function managedConnection(): bool { return getenv('DB_HOST') !== false && getenv('DB_HOST') !== ''; }
function database(?array $config = null): PDO {
    if ($config === null && managedConnection()) {
        $passwordFile = getenv('DB_PASSWORD_FILE');
        $password = $passwordFile ? file_get_contents($passwordFile) : getenv('DB_PASSWORD');
        if ($password === false || $password === '') throw new RuntimeException('No se encontro la credencial de la base administrada.');
        $config = ['host'=>getenv('DB_HOST'), 'port'=>getenv('DB_PORT') ?: '5432', 'database'=>getenv('DB_NAME') ?: 'proyecto_villa_horizonte', 'user'=>getenv('DB_USER') ?: 'villa_app', 'password'=>rtrim($password, "\r\n")];
    }
    $config ??= is_file(configPath()) ? json_decode(file_get_contents(configPath()), true, 16, JSON_THROW_ON_ERROR) : parse_ini_file(dirname(configPath()) . '/database.ini');
    if (!$config) throw new RuntimeException('Ejecuta npm run dev para preparar la base local.');
    $host = $config['host'] ?? '127.0.0.1';
    if (!preg_match('/^[a-zA-Z0-9_.-]+$/D', $host) || !ctype_digit((string)$config['port']) || (int)$config['port'] < 1 || (int)$config['port'] > 65535 || !preg_match('/^[a-zA-Z0-9_]+$/D', $config['database'])) throw new RuntimeException('Configuracion de base no valida.');
    return new PDO("pgsql:host=$host;port={$config['port']};dbname={$config['database']};connect_timeout=3", $config['user'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
}
const TABLE_KEYS = ['ciudad_proyecto'=>'id_ciudad', 'distrito_proyecto'=>'id_distrito', 'proyecto'=>'nombre_proyecto', 'cliente'=>'dni_cliente', 'asesor'=>'dni_asesor', 'telefono_cliente'=>'dni_cliente', 'lote'=>'id_lote', 'nota_venta'=>'serie_numero'];
function snapshot(PDO $db): array {
    $data = [];
    foreach (TABLE_KEYS as $table => $key) {
        $rows = $db->query("SELECT * FROM public.$table ORDER BY $key")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            foreach (['id_ciudad','id_distrito','ciudad_proyecto','distrito_proyecto','id_lote','numero_lote','cantidad'] as $field) if (isset($row[$field])) $row[$field] = (int)$row[$field];
            foreach (['area','precio_metro','precio_venta','total_pagar','monto_pagado','precio_unitario'] as $field) if (isset($row[$field])) $row[$field] = (float)$row[$field];
        }
        unset($row);
        $data[$table] = $rows;
    }
    return $data;
}
function callProcedure(PDO $db, string $name, array $args): void {
    $placeholders = implode(',', array_fill(0, count($args), '?'));
    $db->prepare("CALL public.$name($placeholders)")->execute($args);
}
