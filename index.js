const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const app = express();
const upload = multer({ dest: 'uploads/' });

const BUCKET_NAME = 'private-images-bucket';
const REGION = 'ap-south-1';

const s3 = new S3Client({ region: REGION }); 

// Upload image to S3
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: file.originalname,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));
    fs.unlinkSync(file.path); // remove temp file
    res.json({ message: 'Image uploaded successfully', key: file.originalname });

  } catch (err) {
    console.error('UPLOAD ERROR:', err);  // 👈 key line to see exact error in terminal
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// Get image from S3 (via signed URL)
app.get('/image/:key', async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: req.params.key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.redirect(url); // Redirect to S3 signed URL
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
