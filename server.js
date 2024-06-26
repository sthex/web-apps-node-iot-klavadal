const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const EventHubReader = require('./scripts/event-hub-reader.js');
const { getBlob } = require('./scripts/blob-reader.js');

const iotHubConnectionString = process.env.IotHubConnectionString;
if (!iotHubConnectionString) {
    console.error(`Environment variable IotHubConnectionString must be specified.`);
    return;
}
console.log(`Using IoT Hub connection string [${iotHubConnectionString}]`);

const eventHubConsumerGroup = process.env.EventHubConsumerGroup;
console.log(eventHubConsumerGroup);
if (!eventHubConsumerGroup) {
    console.error(`Environment variable EventHubConsumerGroup must be specified.`);
    return;
}
console.log(`Using event hub consumer group [${eventHubConsumerGroup}]`);

const blobContainerConnectionString = process.env.BlobContainerConnectionString;
if (!blobContainerConnectionString) {
    console.error(`Environment variable BlobContainerConnectionString must be specified.`);
    return;
}
console.log(`Using storage connection string [${blobContainerConnectionString}]`);

// Redirect requests to the public subdirectory to the root
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res /* , next */) => {
    res.redirect('/');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
var blob1;
var gotBlobTime;

const maxLen = 50;
var cachedPayloads = new Array(maxLen);



wss.getUniqueID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};

wss.on('connection', async function connection(ws, req) {
    ws.id = wss.getUniqueID();
    console.log('New Client.ID: ' + ws.id);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                let data = "{\"Hallo\":\"" + client.id + "\", \"NumConnected\":" + wss.clients.size + "}";
                console.log(`Broadcasting data ${data}`);
                client.send(data);
            } catch (e) {
                console.error(e);
            }
        }
    });

    if (cachedPayloads)
        cachedPayloads.forEach((payload) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    console.log(`Broadcasting cached data ${payload}`);
                    ws.send(payload);
                } catch (e) {
                    console.error(e);
                }
            }
        })


    try {
        if (!gotBlobTime || !blob1 || new Date().getMinutes() - gotBlobTime.getMinutes() > 30) {
            blob1 = await getBlob(blobContainerConnectionString);
            gotBlobTime = new Date();
        }
        var jsonString = JSON.stringify(blob1);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    console.log(`Broadcasting temperatures: ${jsonString}`);
                    client.send(jsonString);
                } catch (e) {
                    console.error(e);
                }
            }
        });
    }
    catch (exc) {
        console.error(exc);
        let data = "{\"ErrorBlob\":\"" + exc + "\"}";
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(data);
                } catch (e) {
                    console.error(e);
                }
            }
        });
    }


});

wss.broadcast = (data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                console.log(`Broadcasting data ${data}`);
                client.send(data);
            } catch (e) {
                console.error(e);
            }
        }
    });
};

server.listen(process.env.PORT || '3000', () => {
    console.log('Listening on %d.', server.address().port);
});

const eventHubReader = new EventHubReader(iotHubConnectionString, eventHubConsumerGroup);

(async () => {
    await eventHubReader.startReadMessage((message, date, deviceId) => {
        try {
            const payload = {
                IotData: message,
                MessageDate: date || Date.now().toISOString(),
                DeviceId: deviceId,
            };

            // wss.broadcast(JSON.stringify(payload));
            const str = JSON.stringify(payload);
            wss.broadcast(str);

            if (!cachedPayloads)
                cachedPayloads = new Array(maxLen);

            cachedPayloads.push(str);
            if (cachedPayloads.length > maxLen) {
                cachedPayloads.shift();
            }
        } catch (err) {
            console.error('Error broadcasting: [%s] from [%s].', err, message);
        }
    });
})().catch();


// git remote add webapp https://klavadalen.scm.azurewebsites.net:443/Klavadalen.git
// git push webapp master: master

