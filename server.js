const express = require('express');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

const app = express();
const PORT = 3000;

// Serve static files in the 'public' folder
app.use(express.static('public'));

// Endpoint to serve the todo list JSON
app.get('/tasks', (req, res) => {
  fs.readFile('./taskList.json', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading task list:', err);
      res.status(500).json({ error: 'Failed to load tasks' });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Endpoint to save new JSON file from client
app.put('/tasks', (req, res) => {
  let updatedTasks = '';
  
  req.on('data', chunk => { updatedTasks += chunk; });
  req.on('end', () => {
    fs.writeFile('./taskList.json', updatedTasks, (err) => {
      if (err) {
        console.error('Error saving tasks:', err);
        res.status(500).json({ error: 'Failed to save tasks' });
        return;
      }
      res.json({ message: 'Tasks saved successfully' });
    });
  });
});

// Backup Configuration
const BACKUP_FOLDER = './backups';
const MAX_BACKUPS = 14;
const BACKUP_TIME = '0 4 * * *'; // Daily at 4AM
const TIME_ZONE = 'America/New_York';

// Ensure backup folder exists
if (!fs.existsSync(BACKUP_FOLDER)) {
  fs.mkdirSync(BACKUP_FOLDER);
}

// Function to create a backup
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = path.join(BACKUP_FOLDER, `taskList-${timestamp}.json`);
  
  fs.copyFile('./taskList.json', backupFilename, (err) => {
    if (err) {
      console.error('Error creating backup:', err);
      return;
    }
    console.log(`Backup created: ${backupFilename}`);
    manageBackups();
  });
}

// Function to delete old backups
function manageBackups() {
  fs.readdir(BACKUP_FOLDER, (err, files) => {
    if (err) {
      console.error('Error reading backup folder:', err);
      return;
    }
    
    const backups = files
      .map(file => ({ file, time: fs.statSync(path.join(BACKUP_FOLDER, file)).mtime.getTime() }))
      .sort((a, b) => a.time - b.time); // Sort by modification time (oldest first)
    
    if (backups.length > MAX_BACKUPS) {
      const excessBackups = backups.length - MAX_BACKUPS;
      backups.slice(0, excessBackups).forEach(({ file }) => {
        const filePath = path.join(BACKUP_FOLDER, file);
        fs.unlink(filePath, err => {
          if (err) {
            console.error(`Error deleting backup ${file}:`, err);
          } else {
            console.log(`Deleted old backup: ${file}`);
          }
        });
      });
    }
  });
}

// Schedule daily backups
schedule.scheduleJob({ rule: BACKUP_TIME, tz: TIME_ZONE }, createBackup);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
