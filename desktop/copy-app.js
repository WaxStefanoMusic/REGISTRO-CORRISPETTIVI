// Copia l'app (pagina HTML + librerie) dentro desktop/app prima di avviare o creare l'installer,
// così l'app desktop usa sempre l'ultima versione di "Registro Corrispettivi.html".
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dest = path.join(__dirname, 'app');

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.join(dest, 'lib'), { recursive: true });
fs.copyFileSync(path.join(root, 'Registro Corrispettivi.html'), path.join(dest, 'index.html'));
for (const f of fs.readdirSync(path.join(root, 'lib'))) {
  fs.copyFileSync(path.join(root, 'lib', f), path.join(dest, 'lib', f));
}
console.log('App copiata in', dest);
