import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

// Делаем public полностью доступным
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

// Настройка multer для загрузки файлов
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), async (req, res) => {
  try {
    const clientId = Date.now().toString();
    const folder = path.join('public', clientId);
    fs.mkdirSync(folder, { recursive: true });

    const photoFile = path.join(folder, `photo${path.extname(req.files['photo'][0].originalname)}`);
    const videoFile = path.join(folder, `video${path.extname(req.files['video'][0].originalname)}`);
    const qrFile = path.join(folder, 'qrcode.png');
    const photoWithQR = path.join(folder, `photo_with_qr${path.extname(req.files['photo'][0].originalname)}`);
    const mindFile = path.join(folder, 'target.mind');
    const htmlFile = path.join(folder, 'index.html');

    // Перемещаем файлы
    fs.renameSync(req.files['photo'][0].path, photoFile);
    fs.renameSync(req.files['video'][0].path, videoFile);

    // Генерация .mind файла из оригинального фото
    await new Promise((resolve, reject) => {
      exec(
        `./node_modules/.bin/mindar-cli build "${photoFile}" -o "${mindFile}"`,
        (error, stdout, stderr) => {
          if (error) return reject(error);
          if (stderr) console.error(stderr);
          console.log(stdout);
          resolve();
        }
      );
    });

    // Генерация QR кода на страницу
    const baseURL = process.env.BASE_URL || `https://four-5cvw.onrender.com`;
    const qrURL = `${baseURL}/${clientId}/index.html`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    // Накладываем QR на фото
    const photoSharp = sharp(photoFile);
    const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
    const { height } = await photoSharp.metadata();
    await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }]).toFile(photoWithQR);

    // Генерация HTML из шаблона
    const htmlTemplate = fs.readFileSync('template/index.html', 'utf-8')
      .replace(/{{VIDEO}}/g, path.basename(videoFile))
      .replace(/{{PHOTO}}/g, path.basename(photoFile))
      .replace(/{{MIND}}/g, path.basename(mindFile));
    fs.writeFileSync(htmlFile, htmlTemplate);

    res.send(`
      ✅ Готово! <br>
      📌 AR-сайт: <a href="/${clientId}/index.html">${clientId}/index.html</a> <br>
      🖼 Фото с QR: <a href="/${clientId}/${path.basename(photoWithQR)}">Скачать</a>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера: ' + err.message);
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));