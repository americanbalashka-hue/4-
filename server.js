import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import sharp from 'sharp';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

// Базовый URL сервера (Environment Variable на Render)
const baseURL = process.env.BASE_URL || 'https://four-5cvw.onrender.com';

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), async (req, res) => {
  try {
    const clientId = Date.now().toString();
    const folder = `public/${clientId}`;
    fs.mkdirSync(folder, { recursive: true });

    const photoExt = path.extname(req.files['photo'][0].originalname);
    const videoExt = path.extname(req.files['video'][0].originalname);

    const photoFile = `${folder}/photo${photoExt}`;
    const videoFile = `${folder}/video${videoExt}`;
    const qrFile = `${folder}/qrcode.png`;
    const photoWithQR = `${folder}/photo_with_qr${photoExt}`;
    const htmlFile = `${folder}/index.html`;

    // Перемещаем файлы
    fs.renameSync(req.files['photo'][0].path, photoFile);
    fs.renameSync(req.files['video'][0].path, videoFile);

    // Генерируем QR
    const qrURL = `${baseURL}/${clientId}/index.html`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    // Накладываем QR на фото
    const photoSharp = sharp(photoFile);
    const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
    const { height } = await photoSharp.metadata();
    await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }]).toFile(photoWithQR);

    // Генерируем HTML с клиентской генерацией MindAR
    const htmlTemplate = fs.readFileSync('template/index.html', 'utf-8')
      .replace(/{{VIDEO}}/g, path.basename(videoFile))
      .replace(/{{PHOTO}}/g, path.basename(photoFile));
    fs.writeFileSync(htmlFile, htmlTemplate);

    res.send(`
      Готово! <br>
      AR-сайт: <a href="${clientId}/index.html">${clientId}/index.html</a> <br>
      Фото с QR: <a href="${clientId}/${path.basename(photoWithQR)}">Скачать</a>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера');
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server started'));