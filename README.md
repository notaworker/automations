Electricity price and growatt automations

Trying to build something :)
This project checks the electricity price in SE3 sweden including taxes and if the price is negative it will change the export limit value to 0% so you dont get charge for exporting power back to the grid. I run this using github actions every 15 minutes.
This is tested on my Growatt inverter:

Device Model	MOD 10KTL3-XH

Version	DNAA025100

Communication Version Number	ZBDB-0004

Dependend of communication to:

https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_SE3.json (to be able to read the current 15 min price including taxes)

https://server.growatt.com (to be able to send a "API" call to change the export limit value)

https://gmail.com (only to send email about state changes)
