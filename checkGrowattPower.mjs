// Updated code that uses DEVICE_SN instead of GROWATT_DEVICE_ID

const DEVICE_SN = 'your_device_serial_number'; // replace with actual device serial number

function checkPower() {
    // Function logic to check power using DEVICE_SN
    console.log(`Checking power for device: ${DEVICE_SN}`);
}

checkPower();