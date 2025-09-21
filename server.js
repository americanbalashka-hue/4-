import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// Папка для статических файлов
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// Настройка multer для загрузки
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clientDir = path.join(__dirname, 'public', Date.now().toString());
    fs.mkdirSync(clientDir, { recursive: true });
    cb(null, clientDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'photo') cb(null, `photo${ext}`);
    if (file.fieldname === 'video') cb(null, `video${ext}`);
  }
});
const upload = multer({ storage });

// Загрузка фото и видео
app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), (req, res) => {
  const clientDir = path.dirname(req.files['photo'][0].path);
  res.send(`
    AR-сайт готов! <br>
    <a href="/client/${path.basename(clientDir)}">Открыть AR</a>
  `);
});

// Создаём страницу для клиента, подставляя фото и видео
app.get('/client/:id', (req, res) => {
  const clientId = req.params.id;
  const folder = path.join(__dirname, 'public', clientId);
  const files = fs.readdirSync(folder);
  const photoFile = files.find(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));
  const videoFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.m4v'));

  if (!photoFile || !videoFile) return res.send('Файлы не найдены');

  // Читаем шаблон
  let template = fs.readFileSync(path.join(__dirname, 'template', 'index.html'), 'utf-8');
  template = template.replace('{{PHOTO}}', `/public/${clientId}/${photoFile}`);
  template = template.replace('{{VIDEO}}', `/public/${clientId}/${videoFile}`);

  res.send(template);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));