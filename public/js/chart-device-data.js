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
      this.timeData.push(date.toLocaleTimeString("nb-NO", options) + " - "+ wind_dir[parseInt(wind_dir_deg, 10)/45]);

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
        yAxisID: 'WindAvg',
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
        yAxisID: 'WindGust',
        borderColor: 'rgba(24, 120, 240, 1)',
        pointBoarderColor: 'rgba(24, 120, 240, 1)',
        backgroundColor: 'rgba(24, 120, 240, 0.4)',
        pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
        pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
        spanGaps: true,
      }
    //   ,
    //   {
    //     fill: false,
    //     label: 'Retning',
    //     yAxisID: 'Direction',
    //     borderColor: 'rgba(24, 120, 140, 1)',
    //     pointBoarderColor: 'rgba(24, 120, 140, 1)',
    //     backgroundColor: 'rgba(24, 120, 140, 0.4)',
    //     pointHoverBackgroundColor: 'rgba(24, 120, 140, 1)',
    //     pointHoverBorderColor: 'rgba(24, 120, 140, 1)',
    //     spanGaps: true,
    //   }
    ]
  };

  const chartOptions = {
    scales: {
      yAxes: [{
        id: 'WindAvg',
        type: 'linear',
        scaleLabel: {
          labelString: 'Vind (m/s)',
          display: true,
        },
        position: 'left',
        ticks: {
          suggestedMin: 0,
          suggestedMax: 20,
          beginAtZero: true
        }
      },
            {
        id: 'WindGust',
        type: 'linear',
        scaleLabel: {
          labelString: 'Vind (m/s)',
          display: false,
        },
        position: 'right',
        ticks: {
          suggestedMin: 0,
          suggestedMax: 20,
          beginAtZero: true
        }
      }
    //   ,
    //   {
    //     id: 'Direction',
    //     type: 'linear',
    //     scaleLabel: {
    //       labelString: 'Retning (grader)',
    //       display: true,
    //     },
    //     position: 'right',
    //     ticks: {
    //       suggestedMin: -100,
    //       suggestedMax: 400,
    //       beginAtZero: false
    //     }
    //   }
]
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

  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  let needsAutoSelect = true;
//   const deviceCount = document.getElementById('deviceCount');
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

      // time and either temperature or humidity are required
      if (!messageData.MessageDate || (!messageData.IotData.wind_avg_m_s && !messageData.IotData.wind_max_m_s)) {
        console.log('No wind');
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
