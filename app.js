import express from 'express';
import GeotabApi from 'mg-api-js';
import fetch from 'node-fetch';
import path from 'path';

const __dirname = path.resolve();

const app = express();
const port = process.env.PORT || 3000;

// Geotab credentials and Monday access token from environment variables
const api = new GeotabApi({
    credentials: {
        database: process.env.GEOTAB_DATABASE,
        userName: process.env.GEOTAB_USERNAME,
        password: process.env.GEOTAB_PASSWORD
    },
    path: process.env.GEOTAB_PATH || 'my.geotab.com'
});

const mondayAccessToken = process.env.MONDAY_ACCESS_TOKEN;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to trigger odometer readings update
app.get('/update-odometer', async (req, res) => {
    try {
        const result = await updateMondayOdometerReadings();
        res.json({ success: true, message: "Odometer readings updated", data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error updating odometer readings", error });
    }
});

async function fetchMondayGroups() {
    console.log("Fetching Monday.com groups...");
    const query = `query {
        boards(ids: 654431444) {
            groups {
                title
                id
            }
        }
    }`;

    const request = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mondayAccessToken}`,
        },
        body: JSON.stringify({ query })
    };

    const response = await fetch("https://api.monday.com/v2", request);
    const responseData = await response.json();

    if (responseData.data && responseData.data.boards.length > 0) {
        return responseData.data.boards[0].groups;
    } else {
        console.error("Unable to fetch Monday.com groups", responseData);
        return [];
    }
}

async function fetchDevicesAndUpdateOdometer(namesToFind) {
    try {
        const results = [];
        const group = { id: "GroupAssetInformationId" };
        const devices = await api.call('Get', {
            typeName: 'Device',
            search: { groups: [group] },
            resultsLimit: 200
        });

        const now = new Date().toISOString();
        const diagnostic = { id: "DiagnosticOdometerAdjustmentId" };

        for (const device of devices) {
            const deviceIdentifier = device.name.split(/\s*-\s*/)[0];
            if (namesToFind.includes(deviceIdentifier)) {
                results.push({
                    name: device.name,
                    vehicleIdentificationNumber: device.vehicleIdentificationNumber
                });

                const callResult = await api.call('Get', {
                    typeName: 'StatusData',
                    search: {
                        fromDate: now,
                        toDate: now,
                        diagnosticSearch: diagnostic,
                        deviceSearch: { id: device.id }
                    }
                });

                const statusData = callResult[0];
                if (statusData) {
                    const kilometers = statusData.data;
                    const miles = (kilometers * 0.621371).toFixed(6).slice(0, 6);
                    results[results.length - 1].odometer = miles;
                }
            }
        }

        return results.filter(result => result.odometer !== undefined);
    } catch (error) {
        throw error;
    }
}

async function updateMondayOdometerReadings() {
    try {
        const groups = await fetchMondayGroups();
        console.log(`Fetched ${groups.length} groups from Monday.com.`);

        const namesAndItemIds = {
            "155537": "1300352351",
            "155796": "1300342845",
            "155797": "1300341186",
            "162246": "1300345210",
            "162247": "1300349450",
            "162248": "1300348007",
            "164003": "1300356754",
            "164004": "1300357909",
            "164013": "1300354107",
            "164014": "1388749808",
            "292470": "4155597387",
            "292471": "3335426976",
            "292472": "4155600952",
            "292498": "2999228918"
        };

        const devicesWithOdometer = await fetchDevicesAndUpdateOdometer(Object.keys(namesAndItemIds));

        for (const [name, item_id] of Object.entries(namesAndItemIds)) {
            const device = devicesWithOdometer.find(device => device.name.startsWith(name));
            if (device) {
                console.log(`Updating Monday.com for device ${name} with item ID: ${item_id}...`);
                const mutationQuery = `
                    mutation {
                        change_column_value (
                            board_id: 654431444,
                            item_id: "${item_id}",
                            column_id: "miles12",
                            value: "{\\"text\\":\\"${device.odometer}\\"}"
                        ) {
                            id
                        }
                    }
                `;
                await fetch("https://api.monday.com/v2", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${mondayAccessToken}`,
                    },
                    body: JSON.stringify({ query: mutationQuery })
                });
            } else {
                console.log(`No matching device found for ${name}.`);
            }
        }
        
        // Return the result array for the frontend
        return devicesWithOdometer;

    } catch (error) {
        console.error('Error updating Monday.com:', error);
        return [];  // Return an empty array in case of error
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
