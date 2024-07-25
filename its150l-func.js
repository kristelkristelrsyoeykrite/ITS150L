let currentChart = null; // Keep a reference to the current chart

function updateProcesses() {
    const numProcesses = document.getElementById('numProcesses').value;
    const processesContainer = document.getElementById('processesContainer');
    processesContainer.innerHTML = '';

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

async function runSimulation() {
    const memorySize = parseInt(document.getElementById('memorySize').value);
    const numProcesses = parseInt(document.getElementById('numProcesses').value);
    const compactionTime = parseInt(document.getElementById('compactionTime').value);
    const coalescingHoleTime = parseInt(document.getElementById('coalescingHoleTime').value);
    const processes = [];
    let finalTimeUnit = 0; // This will track the maximum time unit
    let smallestProcess = { size: Infinity, time: 0 }; // Track smallest process
    let output = [];
    let successfulAllocations = [];

    for (let i = 0; i < numProcesses; i++) {
        const size = parseInt(document.querySelector(`[name=processSize${i}]`).value);
        const time = parseInt(document.querySelector(`[name=processTime${i}]`).value);
        processes.push({ id: i + 1, size, time });

        // Update the smallest process
        if (size < smallestProcess.size) {
            smallestProcess = { size, time };
        }
    }

    // Sort processes by size (smallest first)
    processes.sort((a, b) => a.size - b.size);

    let memory = Array(memorySize).fill(null);

    for (let i = 0; i < processes.length; i++) {
        const process = processes[i];
        const allocated = allocateProcess(memory, process, output);

        if (allocated) {
            successfulAllocations.push({ id: process.id, size: process.size, blockNo: output.find(item => item.id === process.id).blockNo });
            finalTimeUnit = Math.max(finalTimeUnit, process.time);
        } else {
            output.push({ id: process.id, size: process.size, blockNo: 'Not Allocated', time: 'N/A' });
        }
    }

    // Update the chart once after all processes are allocated
    updateChart(memory, memorySize, smallestProcess, successfulAllocations, 'Initial Allocation');
    updateTable(output);

    // After all processes, update the final time unit and smallest process info
    const finalTimeUnitElem = document.getElementById('finalTimeUnitValue');
    const smallestProcessSizeElem = document.getElementById('smallestProcessSize');
    const smallestProcessTimeElem = document.getElementById('smallestProcessTime');

    if (finalTimeUnitElem) {
        // Display final time unit including compaction and coalescing times
        finalTimeUnitElem.innerText = (finalTimeUnit + compactionTime + coalescingHoleTime) / 1000; // Convert ms to s
    }
    if (smallestProcessSizeElem) {
        smallestProcessSizeElem.innerText = smallestProcess.size;
    }
    if (smallestProcessTimeElem) {
        smallestProcessTimeElem.innerText = smallestProcess.time;
    }

    // Update process times after all allocations
    for (const process of processes) {
        if (output.find(item => item.id === process.id).blockNo !== 'Not Allocated') {
            await updateProcessTimes(process, memory, compactionTime, coalescingHoleTime);
        }
    }
}

function allocateProcess(memory, process, output) {
    let bestFitIndex = -1;
    let bestFitSize = Infinity;

    // Scan memory to find the best-fit block
    for (let i = 0; i <= memory.length - process.size; i++) {
        if (memory.slice(i, i + process.size).every(cell => cell === null)) {
            const blockSize = memory.slice(i, i + process.size).length;
            if (blockSize < bestFitSize) {
                bestFitSize = blockSize;
                bestFitIndex = i;
            }
        }
    }

    if (bestFitIndex !== -1) {
        memory.fill(process.id, bestFitIndex, bestFitIndex + process.size);
        output.push({ id: process.id, size: process.size, blockNo: bestFitIndex + 1, time: process.time });
        return true;
    }

    return false;
}

async function updateProcessTimes(process, memory, compactionTime, coalescingHoleTime) {
    const interval = 1000; // 1 second
    let timeRemaining = process.time;

    updateTableRow(process.id, timeRemaining);

    return new Promise(resolve => {
        const intervalId = setInterval(() => {
            if (timeRemaining <= 0) {
                clearInterval(intervalId);
                updateTableRow(process.id, 'Completed');
                freeMemory(process.id, memory); // Free up memory after process completion
                setTimeout(() => {
                    coalesceMemory(memory, compactionTime, coalescingHoleTime); // Coalesce holes after freeing memory
                    resolve();
                }, compactionTime); // Delay before coalescing to show compaction time
            } else {
                timeRemaining--;
                updateTableRow(process.id, timeRemaining);
            }
        }, interval);
    });
}

function freeMemory(processId, memory) {
    for (let i = 0; i < memory.length; i++) {
        if (memory[i] === processId) {
            memory[i] = null;
        }
    }
}

function coalesceMemory(memory, compactionTime, coalescingHoleTime) {
    let start = -1;
    let holeSize = 0;
    let preCompactionMemory = [...memory];

    for (let i = 0; i < memory.length; i++) {
        if (memory[i] === null && start === -1) {
            start = i;
        } else if (memory[i] !== null && start !== -1) {
            // End of a hole
            holeSize = i - start;
            start = -1;
        }
    }

    // Coalesce if there was an open hole at the end of memory
    if (start !== -1) {
        holeSize = memory.length - start;
    }

    // Simulate time taken for coalescing
    if (holeSize > 0) {
        setTimeout(() => {
            let newMemory = Array(memory.length).fill(null);
            let dest = 0;
            for (let i = 0; i < memory.length; i++) {
                if (memory[i] !== null) {
                    newMemory[dest++] = memory[i];
                }
            }
            memory.splice(0, memory.length, ...newMemory);
            document.getElementById('compactionTimer').innerText = `Compaction and coalescing completed in ${compactionTime + coalescingHoleTime} ms`;
            updateChart(memory, memory.length, { size: Infinity, time: 0 }, ['After Compaction']); // Update chart after coalescing
        }, compactionTime); // Delay for compaction time
    } else {
        updateChart(memory, memory.length, { size: Infinity, time: 0 }, ['No Coalescing Needed']); // Update chart if no hole
    }
}

function updateChart(memory, memorySize, smallestProcess, allocationStatus, title) {
    const ctx = document.getElementById('memoryChart').getContext('2d');

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

    const processData = Array.from(new Set(data))
        .filter(v => v)
        .map((processId) => {
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
                ...processData
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
            },
            plugins: {
                title: {
                    display: true,
                    text: title,
                }
            }
        }
    });

    // Update chart to show smallest process
    const smallestProcessChartElem = document.getElementById('smallestProcessChart');
    if (smallestProcessChartElem) {
        smallestProcessChartElem.innerText = `Smallest Process Size: ${smallestProcess.size} KB, Time: ${smallestProcess.time} units`;
    }
}

function updateTableRow(processId, time) {
    const timeCell = document.querySelector(`.process-time-${processId}`);
    if (timeCell) {
        timeCell.innerText = time;
    }
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
