#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Pre-build HTML Cleaner
 * Automatically removes Replit banner scripts, comments, and elements from HTML files
 * before building the application to prevent banner issues in production.
 */

class HTMLCleaner {
  constructor() {
    // Patterns to detect and remove Replit banner content
    this.patterns = {
      // Script tags with Replit banner sources
      scriptTags: [
        /(<script[^>]*src[^>]*replit\.com\/public\/js\/replit-dev-banner\.js[^>]*>.*?<\/script>)/gis,
        /(<script[^>]*src[^>]*replit[^>]*banner[^>]*>.*?<\/script>)/gis,
        /(<script[^>]*replit[^>]*banner[^>]*>.*?<\/script>)/gis,
      ],
      
      // Comments mentioning replit script or banner
      comments: [
        /(<!--[^>]*replit\s+script[^>]*-->)/gis,
        /(<!--[^>]*replit\s+banner[^>]*-->)/gis,
        /(<!--[^>]*replit[^>]*dev[^>]*banner[^>]*-->)/gis,
      ],
      
      // HTML elements with replit banner related attributes
      elements: [
        /(<[^>]*id[^>]*replit[^>]*banner[^>]*>.*?<\/[^>]*>)/gis,
        /(<[^>]*class[^>]*replit[^>]*banner[^>]*>.*?<\/[^>]*>)/gis,
        /(<[^>]*data-replit[^>]*banner[^>]*>.*?<\/[^>]*>)/gis,
        /(<div[^>]*replit[^>]*dev[^>]*banner[^>]*>.*?<\/div>)/gis,
      ]
    };
    
    // Directories to scan for HTML files
    this.htmlDirectories = [
      'client',
      'public',
      'public/admin'
    ];
    
    this.cleanedFiles = [];
    this.removedCount = 0;
  }

  /**
   * Find all HTML files in specified directories
   */
  findHTMLFiles() {
    const htmlFiles = [];
    
    for (const dir of this.htmlDirectories) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir, { recursive: true });
          for (const file of files) {
            if (file.endsWith('.html')) {
              const fullPath = path.join(dir, file);
              if (fs.existsSync(fullPath)) {
                htmlFiles.push(fullPath);
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️  Warning: Could not scan directory ${dir}: ${error.message}`);
        }
      }
    }
    
    return htmlFiles;
  }

  /**
   * Clean a single HTML file of Replit banner content
   */
  cleanHTMLFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Warning: File ${filePath} does not exist, skipping...`);
        return false;
      }

      const originalContent = fs.readFileSync(filePath, 'utf-8');
      let cleanedContent = originalContent;
      let removedInThisFile = 0;

      // Apply all cleaning patterns
      Object.entries(this.patterns).forEach(([category, patternList]) => {
        patternList.forEach((pattern, index) => {
          const matches = cleanedContent.match(pattern);
          if (matches) {
            console.log(`🧹 Removing ${matches.length} ${category} pattern(s) from ${filePath}`);
            matches.forEach(match => {
              console.log(`   - Removed: ${match.substring(0, 80)}${match.length > 80 ? '...' : ''}`);
            });
            cleanedContent = cleanedContent.replace(pattern, '');
            removedInThisFile += matches.length;
            this.removedCount += matches.length;
          }
        });
      });

      // Only write back if content changed
      if (cleanedContent !== originalContent) {
        fs.writeFileSync(filePath, cleanedContent, 'utf-8');
        this.cleanedFiles.push(filePath);
        console.log(`✅ Cleaned ${filePath} (removed ${removedInThisFile} item(s))`);
        return true;
      } else {
        console.log(`✨ ${filePath} is already clean`);
        return false;
      }

    } catch (error) {
      console.error(`❌ Error cleaning ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Main cleaning function
   */
  clean() {
    console.log('🧹 HTML Cleaner: Starting pre-build cleanup...');
    console.log('🔍 Scanning for HTML files...');
    
    const htmlFiles = this.findHTMLFiles();
    
    if (htmlFiles.length === 0) {
      console.log('📝 No HTML files found to clean');
      return;
    }

    console.log(`📋 Found ${htmlFiles.length} HTML file(s) to process:`);
    htmlFiles.forEach(file => console.log(`   - ${file}`));
    console.log('');

    // Clean each HTML file
    htmlFiles.forEach(file => {
      this.cleanHTMLFile(file);
    });

    // Summary
    console.log('');
    console.log('📊 Cleanup Summary:');
    console.log(`   - Files processed: ${htmlFiles.length}`);
    console.log(`   - Files cleaned: ${this.cleanedFiles.length}`);
    console.log(`   - Total items removed: ${this.removedCount}`);
    
    if (this.cleanedFiles.length > 0) {
      console.log('   - Cleaned files:');
      this.cleanedFiles.forEach(file => console.log(`     * ${file}`));
    }

    console.log('✅ HTML Cleaner: Pre-build cleanup complete!');
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleaner = new HTMLCleaner();
  cleaner.clean();
}

export default HTMLCleaner;