const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const app = express();
const upload = multer({ dest: 'uploads/' });

const BUCKET_NAME = 'private-images-bucket'; 
const REGION = 'ap-south-1';                 

const s3 = new S3Client({ region: REGION }); 

// Upload image to S3
// app.post('/upload', upload.single('image'), async (req, res) => {
//   try {
//     const file = req.file;
//     if (!file) return res.status(400).json({ error: 'No image provided' });

//     const uploadParams = {
//       Bucket: BUCKET_NAME,
//       Key: file.originalname,
//       Body: fs.createReadStream(file.path),
//       ContentType: file.mimetype,
//     };

//     await s3.send(new PutObjectCommand(uploadParams));
//     fs.unlinkSync(file.path);

//     res.status(201).json({ message: 'Image uploaded successfully', key: file.originalname });

//   } catch (err) {
//     console.error('UPLOAD ERROR:', err);
//     res.status(500).json({ error: 'Upload failed', details: err.message });
//   }
// });


app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image provided' });

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: file.originalname,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));
    fs.unlinkSync(file.path); // delete local temp file

    // ✅ Generate signed URL valid for 45 minutes
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.originalname,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 2700 }); // 2700 sec = 45 min

    res.status(201).json({
      message: 'Image uploaded successfully',
      key: file.originalname,
      signedUrl: signedUrl,
      expiresInMinutes: 45
    });

  } catch (err) {
    console.error('UPLOAD ERROR:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// Get single image (signed URL)
app.get('/image/:key', async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: req.params.key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.redirect(url);
  } catch (err) {
    console.error('GET ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch image', details: err.message });
  }
});

// Get all images (list keys)
app.get('/images', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
    const response = await s3.send(command);
    const keys = (response.Contents || []).map(obj => obj.Key);
    res.json({ images: keys });
  } catch (err) {
    console.error('LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to list images', details: err.message });
  }
});

app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
