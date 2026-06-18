import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parseDependencyFile } from './parser.js';
import { scanDependencies } from './scanner.js';
import { generatePdfReport } from './pdfGenerator.js';

const app = express();
const port = process.env.PORT || 5000;

// Configure middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Configure multer for in-memory storage (to prevent file leaks on server disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // limit file size to 5MB
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Scan endpoint - parses uploaded dependency file and queries OSV API
 */
app.post('/api/scan', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file was uploaded. Please upload package.json, package-lock.json, or requirements.txt.' });
  }

  const fileName = req.file.originalname;
  const fileContent = req.file.buffer.toString('utf8');

  try {
    // 1. Parse dependencies (direct and transitive)
    const packages = await parseDependencyFile(fileName, fileContent);

    if (packages.length === 0) {
      return res.json({
        fileName,
        packages: [],
        vulnerabilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, unpatchedCritical: 0, clean: 0, totalScanned: 0 }
      });
    }

    // 2. Scan packages against OSV database
    const scanResult = await scanDependencies(packages);

    res.json({
      fileName,
      packages,
      vulnerabilities: scanResult.vulnerabilities,
      summary: scanResult.summary
    });
  } catch (error) {
    console.error('Scan error:', error.message);
    res.status(500).json({ error: error.message || 'An error occurred while parsing and scanning the dependency file.' });
  }
});

/**
 * Report endpoint - generates PDF report from scan results
 */
app.post('/api/report', async (req, res) => {
  const { scanResult, fileName } = req.body;

  if (!scanResult || !fileName) {
    return res.status(400).json({ error: 'Invalid payload. scanResult and fileName are required.' });
  }

  try {
    const pdfBuffer = await generatePdfReport(scanResult, fileName);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="depscan-report-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate PDF vulnerability report.' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`DepScan API server is running on port ${port}`);
});
