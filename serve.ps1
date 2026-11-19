# Мини-сервер для локального запуска (без Node и Python).
# Запуск:  powershell -ExecutionPolicy Bypass -File serve.ps1   → откройте http://localhost:5173
param([int]$Port = 5173)

$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Glasses in Red: http://localhost:$Port  (Ctrl+C — остановить)"

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.json' = 'application/json'; '.ico' = 'image/x-icon'
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    $res = $ctx.Response
    if ($ctx.Request.HttpMethod -eq 'POST' -and $path -eq '__save-corridors') {
      # Только для разработки: сохраняет вшитую геометрию коридоров (см. README, «Пересобрать коридоры»)
      $reader = New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)
      $json = $reader.ReadToEnd()
      $out = "/* Сгенерировано автоматически: геометрия коридоров по улицам. Не редактировать вручную. */`nGIR.data.corridors = $json;`n"
      [IO.File]::WriteAllText((Join-Path $root 'js\data\corridors.js'), $out, (New-Object Text.UTF8Encoding $false))
      $res.StatusCode = 204
    }
    elseif ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.Close()
    } catch { try { $ctx.Response.Abort() } catch {} }
  }
} finally {
  $listener.Stop()
}
