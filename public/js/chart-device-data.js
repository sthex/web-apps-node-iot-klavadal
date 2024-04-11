/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
    // if deployed to a site supporting SSL, use wss://
    const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
    const webSocket = new WebSocket(protocol + location.host);
    const wind_dir = ["N ", "NØ", "Ø ", "SØ", "S ", "SV", "V ", "NV", "?"];

    // A class for holding the last N points of telemetry for a device
    class DeviceData {

        constructor(deviceId) {
            this.deviceId = deviceId;
            this.maxLen = 50;
            this.timeData = new Array(this.maxLen);
            this.windAvgData = new Array(this.maxLen);
            this.windMaxData = new Array(this.maxLen);
            this.windDirData = new Array(this.maxLen);
            //   this.windStringData = new Array(this.maxLen);
        }

        addData(time, windAvg, windMax, wind_dir_deg) {
            //   this.timeData.push(time);
            // let date = new Date(Date.UTC(2018, 5, 26, 7, 0, 0));
            let date = new Date(time);
            let options = { hour12: false };
            this.timeData.push(date.toLocaleTimeString("nb-NO", options) + " - " + wind_dir[parseInt(wind_dir_deg, 10) / 45]);

            this.windAvgData.push(windAvg);
            this.windMaxData.push(windMax || null);
            this.windDirData.push(wind_dir_deg);
            //    this.windStringData.push(wind_dir[parseInt(wind_dir_deg, 10)/45]);

            if (this.timeData.length > this.maxLen) {
                this.timeData.shift();
                this.windAvgData.shift();
                this.windMaxData.shift();
                this.windDirData.shift();
                // this.windStringData.shift();
            }
        }
    }

    // All the devices in the list (those that have been sending telemetry)
    class TrackedDevices {
        constructor() {
            this.devices = [];
        }

        // Find a device based on its Id
        findDevice(deviceId) {
            for (let i = 0; i < this.devices.length; ++i) {
                if (this.devices[i].deviceId === deviceId) {
                    return this.devices[i];
                }
            }

            return undefined;
        }

        getDevicesCount() {
            return this.devices.length;
        }
    }

    const trackedDevices = new TrackedDevices();

    // Define the chart axes
    const chartData = {
        datasets: [
            {
                fill: false,
                label: 'Middel',
                yAxisID: 'WindY',
                borderColor: 'rgba(255, 204, 0, 1)',
                pointBoarderColor: 'rgba(255, 204, 0, 1)',
                backgroundColor: 'rgba(255, 204, 0, 0.4)',
                pointHoverBackgroundColor: 'rgba(255, 204, 0, 1)',
                pointHoverBorderColor: 'rgba(255, 204, 0, 1)',
                spanGaps: true,
            },
            {
                fill: false,
                label: 'Kast',
                yAxisID: 'WindY',
                borderColor: 'rgba(24, 120, 240, 1)',
                pointBoarderColor: 'rgba(24, 120, 240, 1)',
                backgroundColor: 'rgba(24, 120, 240, 0.4)',
                pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
                pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
                spanGaps: true,
            }
        ]
    };

    const chartDataT = {
        datasets: [
            {
                type: 'scatter',
                label: 't1 tråløs',
                yAxisID: 'TemperatureY',
                borderColor: 'rgba(0, 204, 0, 1)',
                pointBoarderColor: 'rgba(0, 204, 0, 1)',
                backgroundColor: 'rgba(0, 204, 0, 0.4)',
                pointHoverBackgroundColor: 'rgba(0, 204, 0, 1)',
                pointHoverBorderColor: 'rgba(0, 204, 0, 1)',
            },
            {
                type: 'scatter',
                label: 't2 kablet',
                yAxisID: 'TemperatureY',
                borderColor: 'rgba(240, 0, 0, 1)',
                pointBoarderColor: 'rgba(240, 0, 0, 1)',
                backgroundColor: 'rgba(240, 0, 0, 0.4)',
                pointHoverBackgroundColor: 'rgba(240, 0, 0, 1)',
                pointHoverBorderColor: 'rgba(240, 0, 0, 1)',
            }
        ]
    };
    // const chartDataT = {
    //     labels: labels1, // place labels array in correct spot
    //     datasets: [{
    //         type: 'line',
    //         label: 'Line Dataset',
    //         data: [10, 10, 10, 10],
    //         backgroundColor: 'rgb(0, 0, 255)',
    //         borderColor: 'rgb(0, 0, 255)',
    //         xAxisID: 'x2' // Specify to which axes to link
    //     },
    //     {
    //         type: 'scatter',
    //         backgroundColor: 'rgb(0, 0, 0)',
    //         borderColor: 'rgb(255, 0, 0)',
    //         data: [{
    //             x: 1,
    //             y: 36
    //         }, {
    //             x: 1,
    //             y: 37
    //         }, {
    //             x: 1,
    //             y: 40
    //         }, {
    //             x: 1,
    //             y: 40
    //         }]
    //     }
    //     ],
    // }

    const chartOptions = {
        scales: {
            yAxes: [{
                id: 'WindY',
                type: 'linear',
                scaleLabel: {
                    labelString: 'Vind (m/s)',
                    display: true,
                },
                position: 'right',
                ticks: {
                    min: 0,
                    suggestedMax: 24,
                    stepSize: 3
                }
            },

            ]
        }
    };

    const chartOptionsT = {
        scales: {
            xAxes: [{
                ticks: {
                    userCallback: function (label, index, labels) {
                        const d = new Date(label);
                        // let options = { hour12: false, };
                        // return d.toLocaleTimeString("nb-NO", options);
                        return Intl.DateTimeFormat('nb-NO', { weekday: 'short' }).format(d) + " "
                            + Intl.DateTimeFormat('nb-NO', { hour: '2-digit' }).format(d) + ":"
                            + Intl.DateTimeFormat('nb-NO', { minute: '2-digit' }).format(d);
                        // return moment(label).format("DD/MM/YY");
                    }
                }
            }],
            yAxes: [{
                id: 'TemperatureY',
                scaleLabel: {
                    labelString: 'Temperatur (C)',
                    display: true,
                },
                position: 'left',
                ticks: {
                    suggestedMin: -5,
                    suggestedMax: 10,
                    stepSize: 2
                },
                grid: {
                    display: false
                }
            }]
        }
    };
    // Get the context of the canvas element we want to select
    const ctx = document.getElementById('iotChart').getContext('2d');
    const myLineChart = new Chart(
        ctx,
        {
            type: 'line',
            data: chartData,
            options: chartOptions,
        });

    const tmp = document.getElementById('tmpChart').getContext('2d');
    const myTempChart = new Chart(
        tmp,
        {
            type: 'scatter',
            data: chartDataT,
            options: chartOptionsT,
        });


    // Manage a list of devices in the UI, and update which device data the chart is showing
    // based on selection
    let needsAutoSelect = true;
    //   const deviceCount = document.getElementById('deviceCount');
    const clientCount = document.getElementById('clientCount');
    const listOfDevices = document.getElementById('listOfDevices');
    function OnSelectionChange() {
        const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
        chartData.labels = device.timeData;
        chartData.datasets[0].data = device.windAvgData;
        chartData.datasets[1].data = device.windMaxData;
        myLineChart.update();
    }
    listOfDevices.addEventListener('change', OnSelectionChange, false);

    // When a web socket message arrives:
    // 1. Unpack it
    // 2. Validate it has date/time and temperature
    // 3. Find or create a cached device to hold the telemetry data
    // 4. Append the telemetry data
    // 5. Update the chart UI
    webSocket.onmessage = function onMessage(message) {
        try {
            const messageData = JSON.parse(message.data);
            console.log(messageData);

            if (!messageData.MessageDate || messageData.IotData.model != "Cotech-513326") {// (!messageData.IotData.wind_avg_m_s && !messageData.IotData.wind_max_m_s)) {

                if (messageData.NumConnected > -1) {
                    clientCount.innerText = `${messageData.NumConnected} besøkende`;
                }
                else if (messageData.t1) {

                    // chartDataT.labels = messageData.t1.map(function (e) {
                    //     let date = new Date(e.x);
                    //     let options = { hour12: false };
                    //     return date.toLocaleTimeString("nb-NO", options);
                    // });
                    chartDataT.datasets[0].data = messageData.t1;
                    chartDataT.datasets[1].data = messageData.t2;
                    // chartDataT.datasets[0].data = messageData.t1.map(function (e) {
                    //     return e.celsius;
                    // });
                    // chartDataT.datasets[1].data = messageData.t2.map(function (e) {
                    //     return e.celsius;
                    // });
                    myTempChart.update();
                }
                else
                    console.log('Ukjent data');
                return;
            }

            // find or add device to list of tracked devices
            const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);

            if (existingDeviceData) {
                existingDeviceData.addData(messageData.MessageDate, messageData.IotData.wind_avg_m_s, messageData.IotData.wind_max_m_s, messageData.IotData.wind_dir_deg);
            } else {
                const newDeviceData = new DeviceData(messageData.DeviceId);
                trackedDevices.devices.push(newDeviceData);
                const numDevices = trackedDevices.getDevicesCount();
                // deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;
                newDeviceData.addData(messageData.MessageDate, messageData.IotData.wind_avg_m_s, messageData.IotData.wind_max_m_s, messageData.IotData.wind_dir_deg);

                // add device to the UI list
                const node = document.createElement('option');
                const nodeText = document.createTextNode(messageData.DeviceId);
                node.appendChild(nodeText);
                listOfDevices.appendChild(node);

                // if this is the first device being discovered, auto-select it
                if (needsAutoSelect) {
                    needsAutoSelect = false;
                    listOfDevices.selectedIndex = 0;
                    OnSelectionChange();
                }
            }

            myLineChart.update();
        } catch (err) {
            console.error(err);
        }
    };
});
