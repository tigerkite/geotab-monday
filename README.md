# Run Miles

Run Miles is a fleet management app designed to update and manage odometer readings for various vehicles. It integrates with [Monday.com](https://monday.com/) for real-time data tracking and uses the Geotab API to pull and display mileage updates.

## Features

- Updates odometer readings for vehicles
- Displays updated miles on a web interface
- Exports data as a report

## Installation

1. **Clone this repository**
2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Set up environment variables** for `MONDAY_ACCESS_TOKEN` and Geotab credentials.

4. **Run the app locally**

    ```bash
    npm start
    ```

## Usage

Visit `/update-odometer` to fetch and display updated readings.

---

