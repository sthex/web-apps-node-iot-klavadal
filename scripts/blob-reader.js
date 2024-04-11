const { BlobServiceClient } = require('@azure/storage-blob');

async function getBlob(blobContainerConnectionString) {

    const containerName = "hexcontainer";
    const connectionString = blobContainerConnectionString ? blobContainerConnectionString : process.env.BlobContainerConnectionString

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobnames = await getLastBlobNames(containerClient, 'HexIoTHub/00/', 150);

    var temperatures = {
        t1: [],
        t2: []
    };

    console.log(`Found ${blobnames.length} blobs`);

    for (let i = 0; i < blobnames.length; i++) {
        // for (let i = 0; i < 5; i++) {
        const blobName = blobnames[i];
        console.log('Read blob:', blobName);

        const blobClient = containerClient.getBlobClient(blobName);

        // Download the blob content
        const response = await blobClient.download();
        const blobContent = await streamToString(response.readableStreamBody);
        // try {
        // console.log('Blob content:', blobContent);
        const time = blobTime(blobContent);
        // console.log('- Blob time:', Date(time));
        deviceId = blobDeviceId(blobContent);
        // console.log('- Blob device:', deviceId);
        if (deviceId === 'epdFjell') {
            const temp = UteTemperature_epdFjell(blobContent);
            console.log('- Utetemp:', temp);
            temperatures.t1.push({ "x": time, "y": temp });
        }
        else if (deviceId === 'T5_n4') {
            const temp = UteTemperature_T5_n4(blobContent);
            console.log('- Utetemp kablet:', temp);
            temperatures.t2.push({ "x": time, "y": temp });
        }
        // else {
        //     const ifrom = blobContent.indexOf("deviceId") - 2;
        //     const ilast = blobContent.indexOf("}", ifrom) + 1;
        //     if (ifrom > 50) {
        //         let inner = blobContent.substring(ifrom, ilast);
        //         // Parse the content as JSON
        //         const jsonObject = JSON.parse(inner);
        //         // console.log('JSON content:', jsonObject);
        //         if (jsonObject.deviceId === 'T5_n4') {
        //             // console.log('Sensors content:', jsonObject.msg.Sensors);
        //             // const fra=jsonObject.msg.Sensors.indexOf(",Stue;")+6;
        //             // const til=jsonObject.msg.Sensors.indexOf(",",fra);
        //             // const tUteStr=jsonObject.msg.Sensors.substring(fra,til);
        //             var temperature = jsonObject.t1;
        //             console.log('- Utetemp kablet:', temperature);
        //             temperatures.t2.push({ "time": time, "celsius": temperature });
        //         }
        //     }
        // }


        // } catch (e) { console.error(e) }
    }
    temperatures.t1.sort((a, b) => a.time - b.time);
    temperatures.t2.sort((a, b) => a.time - b.time);

    return temperatures;
}
async function getLastBlobNames(containerClient, prefix, requestedCount) {

    // page size - artificially low as example
    const maxPageSize = 200;
    const blobnames = [];
    let i = 0;
    let marker;
    const date = new Date();

    while (blobnames.length < requestedCount) {
        // some options for filtering list
        const listOptions = {
            includeMetadata: false,
            includeSnapshots: false,
            includeTags: false,
            includeVersions: false,
            prefix: prefix + date.getFullYear() + "/"
                + Intl.DateTimeFormat('en', { month: '2-digit' }).format(date) + "/"
                + Intl.DateTimeFormat('en', { day: '2-digit' }).format(date)
        };
        console.log(`----prefix: ${listOptions.prefix}`);

        let iterator = containerClient.listBlobsFlat(listOptions).byPage({ maxPageSize });
        let response = (await iterator.next()).value;

        // Prints blob names
        for (const blob of response.segment.blobItems) {
            blobnames[i++] = blob.name;
            // console.log(`Flat listing: ${i}: ${blob.name}`);
        }

        // Gets next marker
        marker = response.continuationToken;
        // no more blobs
        if (marker) {

            // Passing next marker as continuationToken    
            iterator = containerClient.listBlobsFlat(listOptions).byPage({
                continuationToken: marker,
                maxPageSize: maxPageSize
            });
            response = (await iterator.next()).value;


            // Prints next blob names
            for (const blob of response.segment.blobItems) {
                blobnames[i++] = blob.name;
                // console.log(`Flat listingX: ${i}: ${blob.name}`);
            }
            marker = response.continuationToken;
        }
        date.setDate(date.getDate() - 1);
        if (new Date().getDate() - date.getDate() > 15)
            return blobnames;
    }
    return blobnames;
}
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        let result = '';
        readableStream.on('data', (data) => {
            result += data.toString();
        });
        readableStream.on('end', () => {
            resolve(result);
        });
        readableStream.on('error', reject);
    });
}
function blobTime(blob) {
    const fra = blob.indexOf("enqueuedTime", 500) + 13; //enqueuedTime82024-04-06T00:08:59.9700000Z
    const til = blob.indexOf("Z", fra) + 1;
    const timeStr = blob.substring(fra, til);
    const time = Date.parse(timeStr);
    return time;
}
function blobDeviceId(blob) {
    const fra = blob.indexOf("connectionDeviceId", 350) + 19;
    const til = blob.indexOf("(", fra);
    const device = blob.substring(fra, til);
    return device;
}
function UteTemperature_epdFjell(blob) {
    const fra = blob.indexOf(",Stue;", 500) + 6;
    const til = blob.indexOf(",", fra);
    const tUteStr = blob.substring(fra, til);
    return parseInt(tUteStr) / 10.0;
}
function UteTemperature_T5_n4(blob) {
    const fra = blob.indexOf("\"t1\":", 600) + 5;
    const til = blob.indexOf(",", fra);
    const tUteStr = blob.substring(fra, til);
    return Number(tUteStr);
}
// getBlob().catch((err) => {
//     console.error('Error:', err);
// });




module.exports = {
    getBlob
}