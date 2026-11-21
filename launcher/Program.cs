using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class Program
{
    internal static bool HasApplication(string directory)
    {
        return File.Exists(Path.Combine(directory, "compose.yaml"))
            && File.Exists(Path.Combine(directory, "scripts", "docker.ps1"))
            && File.Exists(Path.Combine(directory, "frontend", "index.html"));
    }

    [STAThread]
    private static int Main(string[] args)
    {
        string directory = AppDomain.CurrentDomain.BaseDirectory;
        if (args.Length > 0 && args[0] == "--self-test")
            return HasApplication(args.Length > 1 ? args[1] : directory) ? 0 : 2;
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Launcher(directory));
        return 0;
    }
}

internal sealed class Launcher : Form
{
    private readonly string directory;
    private readonly Label status;
    private readonly Button retry;
    private readonly Button open;
    private readonly TextBox details;

    internal Launcher(string directory)
    {
        this.directory = directory;
        Text = "Villa Horizonte";
        ClientSize = new Size(570, 350);
        MinimumSize = new Size(580, 390);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10);
        BackColor = Color.FromArgb(247, 245, 240);
        var title = new Label { Text = "Villa Horizonte", Font = new Font("Segoe UI", 20, FontStyle.Bold), ForeColor = Color.FromArgb(40, 83, 71), AutoSize = true, Location = new Point(24, 20) };
        status = new Label { Text = "Preparando el sistema...", AutoSize = false, Location = new Point(26, 75), Size = new Size(515, 42) };
        retry = new Button { Text = "Iniciar sistema", Location = new Point(26, 125), Size = new Size(150, 38) };
        open = new Button { Text = "Abrir sistema", Location = new Point(188, 125), Size = new Size(150, 38), Enabled = false };
        var requirement = new Label { Text = "Requiere Docker Desktop abierto. Conserva esta carpeta completa.", AutoSize = true, Location = new Point(26, 180) };
        details = new TextBox { ReadOnly = true, Multiline = true, ScrollBars = ScrollBars.Vertical, Location = new Point(26, 210), Size = new Size(515, 112), Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right, Font = new Font("Consolas", 9) };
        Controls.AddRange(new Control[] { title, status, retry, open, requirement, details });
        retry.Click += delegate { StartSystem(); };
        open.Click += delegate { OpenSystem(); };
        Shown += delegate { StartSystem(); };
    }

    private void UpdateUi(Action action)
    {
        if (IsDisposed || !IsHandleCreated) return;
        try { BeginInvoke(action); } catch (InvalidOperationException) { }
    }

    private void Log(string line)
    {
        if (String.IsNullOrWhiteSpace(line)) return;
        UpdateUi(delegate { details.AppendText(line + Environment.NewLine); });
    }

    private void StartSystem()
    {
        if (!retry.Enabled) return;
        if (!Program.HasApplication(directory))
        {
            status.Text = "Extrae el ZIP completo y ejecuta VillaHorizonte.exe desde esa carpeta.";
            return;
        }
        retry.Enabled = false;
        open.Enabled = false;
        details.Clear();
        status.Text = "Iniciando el sistema. La primera descarga puede tardar varios minutos.";
        Task.Run(delegate
        {
            try
            {
                var info = new ProcessStartInfo
                {
                    FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe"),
                    Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(directory, "scripts", "docker.ps1") + "\" -Action start",
                    WorkingDirectory = directory,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                using (var process = new Process { StartInfo = info })
                {
                    process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { Log(e.Data); };
                    process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { Log(e.Data); };
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    process.WaitForExit();
                    int code = process.ExitCode;
                    UpdateUi(delegate
                    {
                        retry.Enabled = true;
                        open.Enabled = code == 0;
                        status.Text = code == 0 ? "Sistema disponible. Puedes cerrar esta ventana sin detenerlo." : "No se pudo iniciar. Revisa Docker Desktop y los detalles para volver a intentar.";
                        if (code == 0) OpenSystem();
                    });
                }
            }
            catch (Exception error)
            {
                Log(error.Message);
                UpdateUi(delegate { retry.Enabled = true; status.Text = "No se pudo iniciar el sistema. Revisa los detalles."; });
            }
        });
    }

    private void OpenSystem()
    {
        int port;
        if (!Int32.TryParse(Environment.GetEnvironmentVariable("VILLA_HTTP_PORT"), out port) || port < 1 || port > 65535) port = 8080;
        try { Process.Start(new ProcessStartInfo("http://127.0.0.1:" + port) { UseShellExecute = true }); }
        catch (Exception error) { Log(error.Message); status.Text = "Abre http://127.0.0.1:" + port + " en tu navegador."; }
    }
}
