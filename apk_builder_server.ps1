# ==============================================================================
# Offline APK Builder Server (PowerShell .NET HttpListener)
# Runs a local Web UI & 100% Offline Android APK compilation pipeline
# ==============================================================================

Param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

# Paths to Android SDK and Java JDK
$SdkDir = "C:\Users\Administrator\AppData\Local\Android\Sdk"
$JbrBinDir = "C:\Program Files\Android\Android Studio\jbr\bin"
$BuildToolsDir = Join-Path $SdkDir "build-tools\36.0.0"
$PlatformsDir = Join-Path $SdkDir "platforms\android-37.0"

$Aapt = Join-Path $BuildToolsDir "aapt.exe"
$AndroidJar = Join-Path $PlatformsDir "android.jar"
$Java = Join-Path $JbrBinDir "java.exe"
$Javac = Join-Path $JbrBinDir "javac.exe"
$JarTool = Join-Path $JbrBinDir "jar.exe"
$Keytool = Join-Path $JbrBinDir "keytool.exe"
$D8Jar = Join-Path $BuildToolsDir "lib\d8.jar"
$ZipAlign = Join-Path $BuildToolsDir "zipalign.exe"
$ApkSignerJar = Join-Path $BuildToolsDir "lib\apksigner.jar"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$BaseDir = Get-Location
$OutputDir = Join-Path $BaseDir "output_apks"
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir | Out-Null }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " OFFLINE APK BUILDER SERVER RUNNING" -ForegroundColor Green
Write-Host " Address: http://localhost:$Port" -ForegroundColor Yellow
Write-Host " Output Folder: $OutputDir" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Prepare debug keystore
$GlobalKeystore = Join-Path $env:TEMP "offline_builder_debug.keystore"
if (-not (Test-Path $GlobalKeystore)) {
    Write-Host "Generating debug keystore..." -ForegroundColor Gray
    & $Keytool -genkeypair -v -keystore $GlobalKeystore -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Offline Builder, O=Android, C=US" 2>&1 | Out-Null
}

# HTTP Listener Setup
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://localhost:$Port/")
$Listener.Prefixes.Add("http://127.0.0.1:$Port/")
try {
    $Listener.Start()
} catch {
    Write-Host "Failed to start listener on port $Port." -ForegroundColor Red
    throw $_
}

# Helper to parse multipart form data
function Parse-MultipartFormData ($request) {
    $boundary = ""
    $partsHeader = $request.ContentType.Split(";")
    foreach ($h in $partsHeader) {
        $trimmed = $h.Trim()
        if ($trimmed.StartsWith("boundary=")) {
            $boundary = "--" + $trimmed.Substring(9)
        }
    }
    if ([string]::IsNullOrEmpty($boundary)) { return $null }
    
    $memStream = New-Object System.IO.MemoryStream
    $request.InputStream.CopyTo($memStream)
    $bytes = $memStream.ToArray()
    $memStream.Close()

    $enc = [System.Text.Encoding]::UTF8
    $dataStr = $enc.GetString($bytes)
    
    $delimiter = [string[]]@($boundary)
    $parts = $dataStr.Split($delimiter, [System.StringSplitOptions]::RemoveEmptyEntries)
    
    $fields = @{}
    $files = @()
    
    foreach ($part in $parts) {
        $pTrim = $part.Trim()
        if ($pTrim -eq "--" -or $pTrim.Length -eq 0) { continue }
        $headerEndIndex = $part.IndexOf("`r`n`r`n")
        if ($headerEndIndex -lt 0) { continue }
        
        $headerStr = $part.Substring(0, $headerEndIndex)
        $bodyStr = $part.Substring($headerEndIndex + 4)
        if ($bodyStr.EndsWith("`r`n")) {
            $bodyStr = $bodyStr.Substring(0, $bodyStr.Length - 2)
        }
        
        if ($headerStr -like '*name=*') {
            $nameStart = $headerStr.IndexOf('name="') + 6
            $nameEnd = $headerStr.IndexOf('"', $nameStart)
            if ($nameStart -gt 5 -and $nameEnd -gt $nameStart) {
                $fieldName = $headerStr.Substring($nameStart, $nameEnd - $nameStart)
                
                if ($headerStr -like '*filename=*') {
                    $fnStart = $headerStr.IndexOf('filename="') + 10
                    $fnEnd = $headerStr.IndexOf('"', $fnStart)
                    if ($fnStart -gt 9 -and $fnEnd -gt $fnStart) {
                        $fileName = $headerStr.Substring($fnStart, $fnEnd - $fnStart)
                        $files += @{
                            name = $fieldName
                            filename = $fileName
                            content = $bodyStr
                        }
                    }
                } else {
                    $fields[$fieldName] = $bodyStr.Trim()
                }
            }
        }
    }
    return @{ fields = $fields; files = $files }
}

# Main Request Loop
while ($Listener.IsListening) {
    $context = $Listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    
    $urlPath = $req.Url.AbsolutePath
    
    try {
        if ($urlPath -eq "/" -or $urlPath -eq "/index.html") {
            $uiPath = Join-Path $BaseDir "builder_ui.html"
            if (Test-Path $uiPath) {
                $content = [System.IO.File]::ReadAllBytes($uiPath)
                $res.ContentType = "text/html; charset=utf-8"
                $res.ContentLength64 = $content.Length
                $res.OutputStream.Write($content, 0, $content.Length)
            } else {
                $res.StatusCode = 404
            }
        }
        elseif ($urlPath -eq "/api/build" -and $req.HttpMethod -eq "POST") {
            Write-Host "`n[API] Received new build request..." -ForegroundColor Cyan
            
            $parsed = Parse-MultipartFormData $req
            $fields = $parsed.fields
            $uploadedFiles = $parsed.files
            
            $appName = if ($fields.ContainsKey('appName')) { $fields['appName'] } else { "Radin Racer 3D" }
            $packageName = if ($fields.ContainsKey('packageName')) { $fields['packageName'] } else { "com.radinracer.game" }
            $versionName = if ($fields.ContainsKey('versionName')) { $fields['versionName'] } else { "1.0.0" }
            $orientation = if ($fields.ContainsKey('orientation')) { $fields['orientation'] } else { "sensorLandscape" }
            $fullscreen = if ($fields.ContainsKey('fullscreen') -and $fields['fullscreen'] -eq 'true') { $true } else { $false }
            $useExisting = if ($fields.ContainsKey('useExistingProject') -and $fields['useExistingProject'] -eq 'true') { $true } else { $false }
            
            $buildId = [System.Guid]::NewGuid().ToString().Substring(0, 8)
            $workDir = Join-Path $env:TEMP "apk_build_$buildId"
            
            if (Test-Path $workDir) { Remove-Item -Recurse -Force $workDir }
            New-Item -ItemType Directory -Path "$workDir\src" -Force | Out-Null
            New-Item -ItemType Directory -Path "$workDir\res\values" -Force | Out-Null
            New-Item -ItemType Directory -Path "$workDir\res\drawable" -Force | Out-Null
            New-Item -ItemType Directory -Path "$workDir\assets\www" -Force | Out-Null
            New-Item -ItemType Directory -Path "$workDir\bin" -Force | Out-Null
            
            # Step A: Populate web assets
            if ($useExisting) {
                Write-Host "Copying current workspace game assets..." -ForegroundColor Gray
                $gameFiles = Get-ChildItem -Path $BaseDir -Exclude "output_apks", "android_project", "*.zip", "*.apk", "apk_builder_server.ps1", "builder_ui.html", "Start_APK_Builder.bat", "*.keystore"
                foreach ($gf in $gameFiles) {
                    Copy-Item -Path $gf.FullName -Destination "$workDir\assets\www\" -Recurse -Force
                }
            } else {
                Write-Host "Writing uploaded web files..." -ForegroundColor Gray
                foreach ($f in $uploadedFiles) {
                    if ($f.name -eq 'files') {
                        $targetPath = Join-Path "$workDir\assets\www" $f.filename
                        $targetDir = Split-Path $targetPath -Parent
                        if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
                        [System.IO.File]::WriteAllText($targetPath, $f.content)
                    }
                }
            }
            
            # Ensure index.html exists
            if (-not (Test-Path "$workDir\assets\www\index.html")) {
                "<!DOCTYPE html><html><head><title>$appName</title></head><body style='background:#000;color:#fff;text-align:center;padding-top:20%'><h1>$appName</h1><p>Running in Offline Android WebView</p></body></html>" | Out-File "$workDir\assets\www\index.html" -Encoding utf8
            }
            
            # Ensure offline 3D libraries exist for web games
            if (-not (Test-Path "$workDir\assets\www\three.min.js") -and (Test-Path "$BaseDir\three.min.js")) {
                Copy-Item -Path "$BaseDir\three.min.js" -Destination "$workDir\assets\www\three.min.js" -Force -ErrorAction SilentlyContinue
            }
            if (-not (Test-Path "$workDir\assets\www\peer.min.js") -and (Test-Path "$BaseDir\peer.min.js")) {
                Copy-Item -Path "$BaseDir\peer.min.js" -Destination "$workDir\assets\www\peer.min.js" -Force -ErrorAction SilentlyContinue
            }
            
            # Step B: Generate AndroidManifest.xml
            $packagePath = $packageName.Replace(".", "\")
            New-Item -ItemType Directory -Path "$workDir\src\$packagePath" -Force | Out-Null
            
            $fullscreenThemeAttr = ""
            if ($fullscreen) {
                $fullscreenThemeAttr = 'android:theme="@android:style/Theme.NoTitleBar.Fullscreen"'
            }
            
            $manifestLines = @(
                '<?xml version="1.0" encoding="utf-8"?>',
                '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
                "    package=`"$packageName`"",
                '    android:versionCode="1"',
                "    android:versionName=`"$versionName`">",
                '    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />',
                '    <uses-permission android:name="android.permission.INTERNET" />',
                '    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
                '    <application',
                '        android:label="@string/app_name"',
                '        android:icon="@drawable/ic_launcher"',
                '        android:hardwareAccelerated="true"',
                "        $fullscreenThemeAttr>",
                '        <activity',
                '            android:name=".MainActivity"',
                '            android:exported="true"',
                "            android:screenOrientation=`"$orientation`"",
                '            android:configChanges="orientation|keyboardHidden|screenSize|screenLayout|uiMode">',
                '            <intent-filter>',
                '                <action android:name="android.intent.action.MAIN" />',
                '                <category android:name="android.intent.category.LAUNCHER" />',
                '            </intent-filter>',
                '        </activity>',
                '    </application>',
                '</manifest>'
            )
            [System.IO.File]::WriteAllText("$workDir\AndroidManifest.xml", ($manifestLines -join "`n"), $utf8NoBom)
            
            # Step C: Generate strings.xml & icon
            $stringsLines = @(
                '<?xml version="1.0" encoding="utf-8"?>',
                '<resources>',
                "    <string name=`"app_name`">$appName</string>",
                '</resources>'
            )
            [System.IO.File]::WriteAllText("$workDir\res\values\strings.xml", ($stringsLines -join "`n"), $utf8NoBom)

            # Valid 1x1 PNG launcher icon
            $validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            [System.IO.File]::WriteAllBytes("$workDir\res\drawable\ic_launcher.png", [System.Convert]::FromBase64String($validPngBase64))
            
            # Step D: Generate MainActivity.java
            $javaLines = @(
                "package $packageName;",
                "",
                "import android.app.Activity;",
                "import android.os.Bundle;",
                "import android.view.View;",
                "import android.view.Window;",
                "import android.view.WindowManager;",
                "import android.webkit.WebChromeClient;",
                "import android.webkit.WebSettings;",
                "import android.webkit.WebView;",
                "import android.webkit.WebViewClient;",
                "",
                "public class MainActivity extends Activity {",
                "    private WebView webView;",
                "",
                "    @Override",
                "    protected void onCreate(Bundle savedInstanceState) {",
                "        super.onCreate(savedInstanceState);",
                "        requestWindowFeature(Window.FEATURE_NO_TITLE);",
                "        getWindow().setFlags(",
                "            WindowManager.LayoutParams.FLAG_FULLSCREEN,",
                "            WindowManager.LayoutParams.FLAG_FULLSCREEN",
                "        );",
                "",
                "        webView = new WebView(this);",
                "        WebSettings settings = webView.getSettings();",
                "        settings.setJavaScriptEnabled(true);",
                "        settings.setDomStorageEnabled(true);",
                "        settings.setDatabaseEnabled(true);",
                "        settings.setAllowFileAccess(true);",
                "        settings.setAllowContentAccess(true);",
                "        settings.setAllowFileAccessFromFileURLs(true);",
                "        settings.setAllowUniversalAccessFromFileURLs(true);",
                "        settings.setMediaPlaybackRequiresUserGesture(false);",
                "",
                "        webView.setWebViewClient(new WebViewClient());",
                "        webView.setWebChromeClient(new WebChromeClient());",
                "",
                '        webView.loadUrl("file:///android_asset/www/index.html");',
                "        setContentView(webView);",
                "    }",
                "",
                "    @Override",
                "    public void onBackPressed() {",
                "        if (webView != null && webView.canGoBack()) {",
                "            webView.goBack();",
                "        } else {",
                "            super.onBackPressed();",
                "        }",
                "    }",
                "}"
            )
            [System.IO.File]::WriteAllText("$workDir\src\$packagePath\MainActivity.java", ($javaLines -join "`n"), $utf8NoBom)
            
            # Step E: AAPT1 Package
            Write-Host "Running AAPT1 packaging & binary manifest compilation..." -ForegroundColor Gray
            & $Aapt package -f -m -J "$workDir\src" -M "$workDir\AndroidManifest.xml" -S "$workDir\res" -I $AndroidJar -F "$workDir\bin\unaligned.apk" -A "$workDir\assets"
            
            # Step F: Javac Compile
            Write-Host "Running Javac compilation..." -ForegroundColor Gray
            $javaFiles = Get-ChildItem -Path "$workDir\src" -Recurse -Filter "*.java" | Select-Object -ExpandProperty FullName
            & $Javac -source 8 -target 8 -cp $AndroidJar -d "$workDir\bin" $javaFiles
            
            # Step G: D8 Dexing
            Write-Host "Running D8 DEX bytecode conversion..." -ForegroundColor Gray
            $classFiles = Get-ChildItem -Path "$workDir\bin" -Recurse -Filter "*.class" | Select-Object -ExpandProperty FullName
            & $Java -cp $D8Jar com.android.tools.r8.D8 --lib $AndroidJar --output "$workDir\bin" $classFiles
            
            # Step H: Add classes.dex into APK
            Write-Host "Packaging DEX into APK..." -ForegroundColor Gray
            Push-Location "$workDir\bin"
            & $JarTool uf "$workDir\bin\unaligned.apk" classes.dex
            Pop-Location
            
            # Step I: ZipAlign
            Write-Host "Running ZipAlign optimization..." -ForegroundColor Gray
            & $ZipAlign -f -v 4 "$workDir\bin\unaligned.apk" "$workDir\bin\aligned.apk"
            
            # Step J: ApkSigner with --min-sdk-version 21
            Write-Host "Signing APK with debug keystore..." -ForegroundColor Gray
            $cleanName = $appName -replace '[^a-zA-Z0-9_]', '_'
            $finalApkName = "$($cleanName).apk"
            $finalApkPath = Join-Path $OutputDir $finalApkName
            & $Java -jar $ApkSignerJar sign --min-sdk-version 21 --ks $GlobalKeystore --ks-pass pass:android --key-pass pass:android --out $finalApkPath "$workDir\bin\aligned.apk"
            
            $fileSizeMB = ((Get-Item $finalApkPath).Length / 1MB).ToString("F2") + " MB"
            Write-Host "SUCCESS! Created $finalApkName ($fileSizeMB)" -ForegroundColor Green
            
            $jsonResp = @{
                success = $true
                fileName = $finalApkName
                fileSize = $fileSizeMB
                downloadUrl = "/api/download/$finalApkName"
            } | ConvertTo-Json
            
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $res.ContentType = "application/json"
            $res.ContentLength64 = $buffer.Length
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        elseif ($urlPath.StartsWith("/api/download/")) {
            $apkName = $urlPath.Replace("/api/download/", "")
            $targetFile = Join-Path $OutputDir $apkName
            if (Test-Path $targetFile) {
                $bytes = [System.IO.File]::ReadAllBytes($targetFile)
                $res.ContentType = "application/vnd.android.package-archive"
                $res.AddHeader("X-Content-Type-Options", "nosniff")
                $res.AddHeader("Content-Disposition", "attachment; filename=`"$apkName`"")
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
            }
        }
        else {
            $res.StatusCode = 404
        }
    } catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        $errResp = @{ success = $false; error = $_.ToString() } | ConvertTo-Json
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($errResp)
        $res.StatusCode = 500
        $res.ContentType = "application/json"
        $res.ContentLength64 = $buffer.Length
        $res.OutputStream.Write($buffer, 0, $buffer.Length)
    } finally {
        $res.Close()
    }
}
