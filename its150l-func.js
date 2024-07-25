function updateProcesses() {
    const numProcesses = document.getElementById('numProcesses').value;
    const processesContainer = document.getElementById('processesContainer');
    processesContainer.innerHTML = '';
//eto
    for (let i = 0; i < numProcesses; i++) {
        const processGroup = document.createElement('div');
        processGroup.className = 'form-group';

        const processLabel = document.createElement('label');
        processLabel.innerText = `Process ${i + 1} Size (KB):`;
        const processInput = document.createElement('input');
        processInput.type = 'number';
        processInput.className = 'form-control';
        processInput.name = `processSize${i}`;
        processInput.required = true;

        const timeLabel = document.createElement('label');
        timeLabel.innerText = `Process ${i + 1} Time Units:`;
        const timeInput = document.createElement('input');
        timeInput.type = 'number';
        timeInput.className = 'form-control';
        timeInput.name = `processTime${i}`;
        timeInput.required = true;

        processGroup.appendChild(processLabel);
        processGroup.appendChild(processInput);
        processGroup.appendChild(timeLabel);
        processGroup.appendChild(timeInput);

        processesContainer.appendChild(processGroup);
    }
}

document.getElementById('simulationForm').addEventListener('submit', function(event) {
    event.preventDefault();
    runSimulation();
});

let currentChart = null; // Keep a reference to the current chart

async function runSimulation() {
    const memorySize = parseInt(document.getElementById('memorySize').value);
    const numProcesses = parseInt(document.getElementById('numProcesses').value);
    const processes = [];

    for (let i = 0; i < numProcesses; i++) {
        const size = parseInt(document.querySelector(`[name=processSize${i}]`).value);
        const time = parseInt(document.querySelector(`[name=processTime${i}]`).value);
        processes.push({ id: i + 1, size, time });
    }

    let memory = Array(memorySize).fill(null);
    let output = [];

    for (let i = 0; i < processes.length; i++) {
        const process = processes[i];
        const allocated = allocateProcess(memory, process, output);

        if (allocated) {
            await updateProcessTimes(process, output);
        } else {
            // Process was not allocated
            output.push({ id: process.id, size: process.size, blockNo: 'Not Allocated', time: 'N/A' });
            updateTable(output);
        }
        updateChart(memory, memorySize);
    }
}

function allocateProcess(memory, process, output) {
    let allocated = false;

    for (let i = 0; i <= memory.length - process.size; i++) {
        if (memory.slice(i, i + process.size).every(cell => cell === null)) {
            memory.fill(process.id, i, i + process.size);
            output.push({ id: process.id, size: process.size, blockNo: i + 1, time: process.time });
            allocated = true;
            break;
        }
    }

    return allocated;
}

async function updateProcessTimes(process, output) {
    const interval = 1000; // 1 second
    let timeRemaining = process.time;

    // Update the table row for the current process
    updateTableRow(process.id, timeRemaining);

    while (timeRemaining > 0) {
        await new Promise(resolve => setTimeout(resolve, interval));
        timeRemaining--;
        updateTableRow(process.id, timeRemaining);
    }

    // Update the table row to show 'Completed' after finishing
    updateTableRow(process.id, 'Completed');
}

function updateTableRow(processId, timeRemaining) {
    const timeCell = document.querySelector(`.process-time-${processId}`);

    if (timeCell) {
        timeCell.innerText = timeRemaining;
    } else {
        // Create a new row if it doesn't exist
        const outputTableBody = document.querySelector('#outputTable tbody');
        const row = document.createElement('tr');
        row.className = `process-row-${processId}`;
        row.innerHTML = `
            <td>${processId}</td>
            <td>${document.querySelector(`[name=processSize${processId - 1}]`).value}</td>
            <td>${document.querySelector(`[name=processSize${processId - 1}]`).value}</td>
            <td class="process-time-${processId}">${timeRemaining}</td>
        `;
        outputTableBody.appendChild(row);
    }
}

function updateChart(memory, memorySize) {
    const ctx = document.getElementById('memoryChart').getContext('2d');

    // Destroy the existing chart if it exists
    if (currentChart) {
        currentChart.destroy();
    }

    const data = Array(memorySize).fill(0);
    const holeData = Array(memorySize).fill(0);

    memory.forEach((value, index) => {
        if (value === null) {
            holeData[index]++;
        } else {
            data[index] = value;
        }
    });

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({ length: memorySize }, (_, i) => i + 1),
            datasets: [
                {
                    label: 'Holes',
                    data: holeData,
                    backgroundColor: 'gray',
                },
                ...Array.from(new Set(data)).filter(v => v).map((processId, index) => {
                    const datasetData = Array(memorySize).fill(0);
                    memory.forEach((value, i) => {
                        if (value === processId) {
                            datasetData[i] = 1;
                        }
                    });
                    return {
                        label: `Process ${processId}`,
                        data: datasetData,
                        backgroundColor: `hsl(${processId * 60}, 70%, 50%)`,
                    };
                })
            ],
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateTable(output) {
    const outputTableBody = document.querySelector('#outputTable tbody');
    outputTableBody.innerHTML = '';

    output.forEach(process => {
        const row = document.createElement('tr');
        row.className = `process-row-${process.id}`;
        row.innerHTML = `
            <td>${process.id}</td>
            <td>${process.size}</td>
            <td>${process.blockNo}</td>
            <td class="process-time-${process.id}">${process.time}</td>
        `;
        outputTableBody.appendChild(row);
    });
}
