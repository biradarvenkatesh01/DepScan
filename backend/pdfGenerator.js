import PDFDocument from 'pdfkit';

/**
 * Helper to draw a horizontal separator line
 */
function drawDivider(doc, y) {
  doc.strokeColor('#cbd5e1')
     .lineWidth(1)
     .moveTo(40, y)
     .lineTo(555, y)
     .stroke();
}

/**
 * Map severity name to a color hex code
 */
function getSeverityColor(severity) {
  switch (severity) {
    case 'Critical': return '#991b1b'; // Deep Red
    case 'High': return '#c2410c';     // Dark Orange
    case 'Medium': return '#a16207';   // Dark Yellow/Brown
    case 'Low': return '#1d4ed8';      // Dark Blue
    default: return '#475569';
  }
}

/**
 * Calculate simple security rating
 */
function getSecurityRating(summary) {
  if (summary.critical > 0 || summary.unpatchedCritical > 0) return { grade: 'F', text: 'Critical Risk', color: '#991b1b' };
  if (summary.high > 0) return { grade: 'D', text: 'High Risk', color: '#c2410c' };
  if (summary.medium > 0) return { grade: 'C', text: 'Medium Risk', color: '#a16207' };
  if (summary.low > 0) return { grade: 'B', text: 'Low Risk', color: '#1d4ed8' };
  return { grade: 'A', text: 'Secure', color: '#15803d' };
}

/**
 * Generates a PDF buffer of the scan report using PDFKit
 */
export function generatePdfReport(scanResult, fileName) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      const summary = scanResult.summary;
      const vulns = scanResult.vulnerabilities;
      const rating = getSecurityRating(summary);

      // --- PAGE 1: COVER & EXECUTIVE SUMMARY ---
      
      // Header Banner
      doc.rect(0, 0, 595, 120).fill('#1e293b');
      doc.fillColor('#ffffff')
         .fontSize(24)
         .text('DEPSCAN SECURITY AUDIT REPORT', 40, 40, { characterSpacing: 1 });
      
      doc.fontSize(10)
         .fillColor('#94a3b8')
         .text('Open Source Dependency Vulnerability Tracker', 40, 75);

      // Metainfo block
      const scanDate = new Date().toLocaleString();
      doc.fillColor('#334155')
         .fontSize(10)
         .text(`Target File: ${fileName}`, 40, 150)
         .text(`Scan Date: ${scanDate}`, 40, 165)
         .text(`Total Dependencies Scanned: ${summary.totalScanned}`, 40, 180);

      // Security Grade Badge (Right side of header)
      doc.rect(450, 140, 100, 70).fill(rating.color);
      doc.fillColor('#ffffff')
         .fontSize(36)
         .text(rating.grade, 450, 145, { width: 100, align: 'center' });
      doc.fontSize(10)
         .text(rating.text, 450, 185, { width: 100, align: 'center' });

      // Draw Divider
      drawDivider(doc, 230);

      // Executive Summary Header
      doc.fillColor('#0f172a')
         .fontSize(16)
         .text('Executive Summary', 40, 250);

      const summaryText = summary.total === 0 
        ? `DepScan completed an audit of ${fileName} and found no known open-source vulnerabilities. The dependencies declared are clean and up-to-date according to the OSV database. No immediate remediation action is required.`
        : `DepScan analyzed the dependency tree of ${fileName} (resolving ${summary.totalScanned} direct and transitive packages) and detected a total of ${summary.total} vulnerabilities. Out of these, ${summary.critical} are classified as Critical, ${summary.high} as High, ${summary.medium} as Medium, and ${summary.low} as Low. Special attention is needed for ${summary.unpatchedCritical} Critical vulnerabilities that currently lack a vendor-supplied patch.`;

      doc.fillColor('#334155')
         .fontSize(11)
         .text(summaryText, 40, 275, { lineGap: 4, width: 515 });

      // Vulnerability Breakdown Box
      doc.rect(40, 360, 515, 80).fill('#f8fafc');
      doc.strokeColor('#cbd5e1').rect(40, 360, 515, 80).stroke();

      // Draw Summary Cells inside the Box
      doc.fillColor('#0f172a').fontSize(10);
      let cellX = 60;
      const categories = [
        { label: 'Critical', val: summary.critical, color: '#991b1b' },
        { label: 'High', val: summary.high, color: '#c2410c' },
        { label: 'Medium', val: summary.medium, color: '#a16207' },
        { label: 'Low', val: summary.low, color: '#1d4ed8' },
        { label: 'Unpatched', val: summary.unpatchedCritical, color: '#ef4444' }
      ];

      categories.forEach(cat => {
        doc.fillColor(cat.color).fontSize(18).text(cat.val.toString(), cellX, 375, { width: 80, align: 'center' });
        doc.fillColor('#64748b').fontSize(9).text(cat.label, cellX, 405, { width: 80, align: 'center' });
        cellX += 100;
      });

      // Remediation summary statement
      doc.fillColor('#0f172a').fontSize(12).text('Key Action Items', 40, 470);
      doc.fontSize(10).fillColor('#334155');
      if (summary.total === 0) {
        doc.text('• No action items. All packages are clean.', 50, 495);
      } else {
        let actionY = 495;
        if (summary.critical > 0) {
          doc.text(`• Upgrade the ${summary.critical} Critical packages immediately. Check detail section for upgrade target versions.`, 50, actionY);
          actionY += 20;
        }
        if (summary.unpatchedCritical > 0) {
          doc.text(`• Review ${summary.unpatchedCritical} unpatched critical vulnerabilities for alternative libraries or isolation context.`, 50, actionY);
          actionY += 20;
        }
        if (summary.high > 0) {
          doc.text(`• Schedule remediation for the ${summary.high} High-severity issues within the next maintenance window.`, 50, actionY);
          actionY += 20;
        }
        doc.text('• Export JSON logs to configure automated security blocklists in CI/CD pipeline.', 50, actionY);
      }

      // Page footer info
      doc.fillColor('#94a3b8').fontSize(8).text('Confidential - DepScan Security Report', 40, 780);
      doc.text('Page 1', 520, 780);

      // --- PAGE 2+: DETAILED VULNERABILITY LIST ---
      if (vulns.length > 0) {
        doc.addPage();
        doc.fillColor('#0f172a').fontSize(16).text('Detailed Vulnerability Report', 40, 40);
        doc.fontSize(9).fillColor('#64748b').text('Items sorted by severity level and CVSS base score.', 40, 60);
        
        let y = 90;
        
        vulns.forEach((vuln, idx) => {
          // Check if we need a new page (each block takes approx 110 pt)
          if (y > 700) {
            doc.addPage();
            doc.fillColor('#0f172a').fontSize(14).text('Detailed Vulnerability Report (Continued)', 40, 40);
            y = 70;
          }

          // Vulnerability header row
          const color = getSeverityColor(vuln.severity);
          doc.rect(40, y, 4, 90).fill(color);

          doc.fillColor('#0f172a').fontSize(11).text(`${idx + 1}. ${vuln.packageName} (${vuln.version})`, 55, y + 2, { bold: true });
          
          // Badges row
          doc.rect(55, y + 18, 50, 13).fill(color);
          doc.fillColor('#ffffff').fontSize(8).text(vuln.severity, 55, y + 21, { width: 50, align: 'center' });
          
          doc.fillColor('#475569').fontSize(9).text(`Score: ${vuln.score}`, 115, y + 20);
          doc.text(`ID: ${vuln.identifier}`, 180, y + 20);
          doc.text(`Ecosystem: ${vuln.ecosystem}`, 300, y + 20);

          // Summary Text
          const cleanSummary = vuln.summary.replace(/\r?\n/g, ' ');
          doc.fillColor('#334155').fontSize(9).text(cleanSummary.length > 130 ? cleanSummary.substring(0, 127) + '...' : cleanSummary, 55, y + 36, { width: 500 });

          // Remediation Text
          doc.fillColor(color).fontSize(9).text(`Remediation: ${vuln.remediation}`, 55, y + 68, { width: 500, bold: true });

          y += 105;
        });

        // Add page footer to page 2+
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 1; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.fillColor('#94a3b8').fontSize(8).text('Confidential - DepScan Security Report', 40, 780);
          doc.text(`Page ${i + 1}`, 520, 780);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
