import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Increased to 10MB
});

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dtdgufs9u';
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'hotel_main';

    console.log('Backend proxying upload for:', req.file.originalname);

    // 1. If SDK configuration exists, use signed upload via stream (highly recommended)
    if (cloudName && apiKey && apiSecret) {
      console.log('Using Cloudinary SDK signed upload');
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret
      });

      // Convert buffer upload to a promise-based stream
      const uploadFromBuffer = (fileBuffer) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'hotel_menu' },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          uploadStream.end(fileBuffer);
        });
      };

      const result = await uploadFromBuffer(req.file.buffer);
      console.log('SDK upload successful! URL:', result.secure_url);
      return res.status(200).json({
        success: true,
        url: result.secure_url
      });
    }

    // 2. Fallback to unsigned upload via fetch using preset
    console.log(`Using fetch unsigned upload (preset: ${uploadPreset}, cloud: ${cloudName})`);
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Cloudinary API Error:', data);
      return res.status(response.status).json({ 
        success: false, 
        message: data.error?.message || 'Cloudinary upload failed' 
      });
    }

    console.log('Unsigned upload success via fetch');
    return res.status(200).json({
      success: true,
      url: data.secure_url
    });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ 
        success: false, 
        message: 'Network/Server Error: ' + error.message 
    });
  }
};

export const uploadMiddleware = upload.single('file');

