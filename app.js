const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs'); // Ensure the fs module is imported
const { Parser } = require('json2csv'); // Correct import


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'hbs');

// Home route
app.get('/', (req, res) => {
    res.render('index');
});
app.get('/api', (req, res) => {
    res.render('api');
});


app.use(express.urlencoded({ extended: true }));

app.post('/scrape', async (req, res) => {
    const url = req.body.url;           // Get the URL from the form
    const fileName = req.body.fileName; // Get the file name from the form
    const year = req.body.year;         // Get the year from the form

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });

        const data = response.data;
        const $ = cheerio.load(data);

        const players = [];

        // Scrape the table
        $('table.table.table-responsive.cb-series-stats tbody tr').each((index, element) => {
            if (index === 0) return; // Skip header row

            const playerName = $(element).find('td:nth-child(1) a').text().trim();
            const matches = $(element).find('td:nth-child(2)').text().trim();
            const innings = $(element).find('td:nth-child(3)').text().trim();
            const runs = $(element).find('td:nth-child(4)').text().trim();
            const average = $(element).find('td:nth-child(5)').text().trim();
            const strikeRate = $(element).find('td:nth-child(6)').text().trim();

            if (playerName && matches && innings && runs && average && strikeRate) {
                // Add the year to each player object
                players.push({ playerName, matches, innings, runs, average, strikeRate, year });
            }
        });

        if (players.length === 0) {
            throw new Error('No data scraped. Please check the CSS selectors or the URL.');
        }

        // Convert to CSV
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(players);

        // Ensure the user provided a file name, and append '.csv' if necessary
        let csvFileName = fileName.trim();
        if (!csvFileName.endsWith('.csv')) {
            csvFileName += '.csv';
        }

        // Save the file in the data directory
        const filePath = path.join(__dirname, 'data', `${csvFileName}`);
        fs.writeFileSync(filePath, csv, 'utf8');

        res.render('response', { message: `Data scraped and saved to ${csvFileName} successfully!`, filePath });
    } catch (error) {
        console.error('Error scraping the URL:', error.message);
        res.render('response', { message: `Error scraping the URL: ${error.message}` });
    }
});


app.post('/crawl-most-runs', async (req, res) => {
    const { url, csvFileName, year } = req.body;
  
    try {
      // Fetch HTML from the given URL
      const response = await axios.get(url);
      const html = response.data;
  
      // Use Cheerio to parse the HTML
      const $ = cheerio.load(html);
  
      // Extract data from the table with class 'table table-responsive cb-series-stats'
      const table = $('.table-responsive.cb-series-stats');
      const rows = table.find('tr');  // Find all rows in the table
  
      // Prepare an array to store scraped data
      const playersData = [];
  
      // Loop through each row and extract data
      rows.each((i, row) => {
        const columns = $(row).find('td');
        if (columns.length > 0) {
          const player = {
            playerName: $(columns[0]).text().trim(),
            matches: $(columns[1]).text().trim(),
            inns: $(columns[2]).text().trim(),
            runs: $(columns[3]).text().trim(),
            avg: $(columns[4]).text().trim(),
            sr: $(columns[5]).text().trim(),
            fours: $(columns[6]).text().trim(),
            sixes: $(columns[7]).text().trim(),
            year: year  // Add the year here
          };
  
          playersData.push(player);
        }
      });
  
      // Convert the data into CSV format (including the year)
      const csvData = [
        ['PLAYER', 'MATCHES', 'INNS', 'RUNS', 'AVG', 'SR', '4s', '6s', 'YEAR'],  // Include 'YEAR' in the headers
        ...playersData.map(player => [
          player.playerName,
          player.matches,
          player.inns,
          player.runs,
          player.avg,
          player.sr,
          player.fours,
          player.sixes,
          player.year  // Add year data to each row
        ]),
      ]
        .map(row => row.join(','))
        .join('\n');
  
      // Define the file path to save the CSV including the year in the file name
      const filePath = path.join(__dirname, 'data', `${csvFileName}_${year}.csv`);
  
      // Save the CSV file
      fs.writeFileSync(filePath, csvData);
  
      // Respond with success message and download link
      res.render('response', {
        message: `Data scraped and saved to ${csvFileName}_${year}.csv successfully!`,
        filePath: `/data/${csvFileName}_${year}.csv`,  // This assumes you are serving the 'data' folder as static
      });
    } catch (error) {
      console.error('Error scraping the URL:', error.message);
      res.render('response', { message: 'Error scraping the URL: ' + error.message });
    }
  });
  



// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
