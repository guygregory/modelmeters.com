/*
 * Azure Retail Prices Explorer - Standalone Version
 *
 * This is a standalone version that doesn't rely on external dependencies
 * like jQuery or DataTables. It provides the core functionality needed
 * to query the Azure Retail Prices API through our proxy.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Available filter fields and operators
    const FILTER_FIELDS = [
        { value: 'armRegionName', label: 'armRegionName' },
        { value: 'location', label: 'location' },
        { value: 'meterId', label: 'meterId' },
        { value: 'meterName', label: 'meterName' },
        { value: 'productId', label: 'productId' },
        { value: 'skuId', label: 'skuId' },
        { value: 'productName', label: 'productName' },
        { value: 'skuName', label: 'skuName' },
        { value: 'serviceName', label: 'serviceName' },
        { value: 'serviceId', label: 'serviceId' },
        { value: 'serviceFamily', label: 'serviceFamily' },
        { value: 'priceType', label: 'priceType' },
        { value: 'armSkuName', label: 'armSkuName' }
    ];
    
    const OPERATORS = [
        { value: 'eq', label: 'equals' },
        { value: 'ne', label: 'not equal' },
        { value: 'contains', label: 'contains' },
        { value: 'startswith', label: 'starts with' },
        { value: 'endswith', label: 'ends with' }
    ];
    
    const CONNECTORS = [
        { value: 'and', label: 'AND' },
        { value: 'or', label: 'OR' }
    ];

    let filterCount = 0;
    let nextPageLink = null;
    let currentData = [];

    // Helper functions for DOM manipulation
    function $(selector) {
        return document.querySelector(selector);
    }
    
    function $$(selector) {
        return document.querySelectorAll(selector);
    }

    // Create a new filter row and append it to the container
    function addFilterRow() {
        filterCount++;
        const rowId = `filterRow${filterCount}`;
        
        const row = document.createElement('div');
        row.className = 'filter-row row g-2 align-items-center';
        row.setAttribute('data-row-id', rowId);
        
        const connectorCol = document.createElement('div');
        connectorCol.className = 'col-auto connector-col';
        if (filterCount === 1) {
            connectorCol.style.display = 'none';
        }
        
        const connectorSelect = document.createElement('select');
        connectorSelect.className = 'form-select form-select-sm connector-select';
        connectorSelect.setAttribute('aria-label', 'Connector');
        CONNECTORS.forEach(op => {
            const option = document.createElement('option');
            option.value = op.value;
            option.textContent = op.label;
            connectorSelect.appendChild(option);
        });
        connectorCol.appendChild(connectorSelect);
        
        const fieldCol = document.createElement('div');
        fieldCol.className = 'col-sm-3';
        const fieldSelect = document.createElement('select');
        fieldSelect.className = 'form-select form-select-sm field-select';
        fieldSelect.setAttribute('aria-label', 'Field');
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        defaultOption.textContent = 'Select field';
        fieldSelect.appendChild(defaultOption);
        
        FILTER_FIELDS.forEach(f => {
            const option = document.createElement('option');
            option.value = f.value;
            option.textContent = f.label;
            fieldSelect.appendChild(option);
        });
        fieldCol.appendChild(fieldSelect);
        
        const operatorCol = document.createElement('div');
        operatorCol.className = 'col-sm-3';
        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'form-select form-select-sm operator-select';
        operatorSelect.setAttribute('aria-label', 'Operator');
        
        const defaultOpOption = document.createElement('option');
        defaultOpOption.value = '';
        defaultOpOption.disabled = true;
        defaultOpOption.selected = true;
        defaultOpOption.textContent = 'Select operator';
        operatorSelect.appendChild(defaultOpOption);
        
        OPERATORS.forEach(o => {
            const option = document.createElement('option');
            option.value = o.value;
            option.textContent = o.label;
            operatorSelect.appendChild(option);
        });
        operatorCol.appendChild(operatorSelect);
        
        const valueCol = document.createElement('div');
        valueCol.className = 'col-sm-4';
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'form-control form-control-sm value-input';
        valueInput.placeholder = 'Enter value';
        valueInput.setAttribute('aria-label', 'Value');
        valueCol.appendChild(valueInput);
        
        const removeCol = document.createElement('div');
        removeCol.className = 'col-auto';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger btn-sm remove-filter-btn';
        removeBtn.title = 'Remove condition';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', function() {
            row.remove();
            updateConnectorVisibility();
        });
        removeCol.appendChild(removeBtn);
        
        row.appendChild(connectorCol);
        row.appendChild(fieldCol);
        row.appendChild(operatorCol);
        row.appendChild(valueCol);
        row.appendChild(removeCol);
        
        $('#filterContainer').appendChild(row);
    }

    // Ensure the first row hides the connector and subsequent rows show it
    function updateConnectorVisibility() {
        const rows = $$('#filterContainer .filter-row');
        rows.forEach((row, index) => {
            const connectorCol = row.querySelector('.connector-col');
            if (index === 0) {
                connectorCol.style.display = 'none';
            } else {
                connectorCol.style.display = 'block';
            }
        });
    }

    // Build an OData filter expression from the UI
    function buildFilterQuery() {
        const rows = $$('#filterContainer .filter-row');
        const parts = [];
        let valid = true;
        
        rows.forEach((row, index) => {
            const field = row.querySelector('.field-select').value;
            const operator = row.querySelector('.operator-select').value;
            const value = row.querySelector('.value-input').value.trim();
            const connector = index > 0 ? row.querySelector('.connector-select').value : '';
            
            if (!field || !operator || !value) {
                valid = false;
                return;
            }
            
            // Escape single quotes in the value for OData compliance
            const escapedValue = value.replace(/'/g, "''");
            let expression;
            
            if (operator === 'eq' || operator === 'ne') {
                expression = `${field} ${operator} '${escapedValue}'`;
            } else if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
                expression = `${operator}(${field}, '${escapedValue}')`;
            } else {
                valid = false;
                return;
            }
            
            if (index > 0) {
                parts.push(`${connector} ${expression}`);
            } else {
                parts.push(expression);
            }
        });
        
        if (!valid || parts.length === 0) {
            return null;
        }
        return parts.join(' ');
    }

    // Construct the API URL with query parameters
    function constructApiUrl(filterQuery) {
        // For local testing, use the mock server port. In production, this will be '/api/prices'
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:7071/api/prices' : '/api/prices';
        const params = [];
        
        if (filterQuery) {
            params.push(`$filter=${encodeURIComponent(filterQuery)}`);
        }
        
        const apiVersion = $('#apiVersionSelect').value;
        if (apiVersion) {
            params.push(`api-version=${encodeURIComponent(apiVersion)}`);
        }
        
        const currency = $('#currencySelect').value;
        if (currency) {
            params.push(`currencyCode=${encodeURIComponent(currency)}`);
        }
        
        if ($('#primaryOnlyCheck').checked) {
            params.push('meterRegion=primary');
        }
        
        return params.length ? `${baseUrl}?${params.join('&')}` : baseUrl;
    }

    // Render results table
    function renderTable(items, resetTable) {
        const tableBody = $('#resultsTable tbody');
        
        if (resetTable) {
            currentData = [];
            tableBody.innerHTML = '';
        }
        
        currentData = currentData.concat(items);
        
        items.forEach(item => {
            const row = document.createElement('tr');
            
            const cells = [
                item.currencyCode || '',
                item.retailPrice != null ? item.retailPrice : '',
                item.unitPrice != null ? item.unitPrice : '',
                item.armRegionName || '',
                item.location || '',
                item.effectiveStartDate || '',
                item.meterId || '',
                item.meterName || '',
                item.productId || '',
                item.skuId || '',
                item.productName || '',
                item.skuName || '',
                item.serviceName || '',
                item.serviceFamily || '',
                item.unitOfMeasure || '',
                item.type || '',
                item.isPrimaryMeterRegion ? 'Yes' : 'No',
                item.armSkuName || ''
            ];
            
            cells.forEach(cellData => {
                const cell = document.createElement('td');
                cell.textContent = cellData;
                row.appendChild(cell);
            });
            
            tableBody.appendChild(row);
        });
        
        $('#resultsSection').style.display = 'block';
    }

    // Export to CSV
    function exportToCsv() {
        if (currentData.length === 0) {
            alert('No data to export');
            return;
        }
        
        const headers = [
            'Currency', 'Retail Price', 'Unit Price', 'Region', 'Location', 'Effective Start',
            'Meter ID', 'Meter Name', 'Product ID', 'SKU ID', 'Product Name', 'SKU Name',
            'Service Name', 'Service Family', 'Unit of Measure', 'Type', 'Primary?', 'ARM SKU Name'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        currentData.forEach(item => {
            const row = [
                item.currencyCode || '',
                item.retailPrice != null ? item.retailPrice : '',
                item.unitPrice != null ? item.unitPrice : '',
                item.armRegionName || '',
                item.location || '',
                item.effectiveStartDate || '',
                item.meterId || '',
                item.meterName || '',
                item.productId || '',
                item.skuId || '',
                item.productName || '',
                item.skuName || '',
                item.serviceName || '',
                item.serviceFamily || '',
                item.unitOfMeasure || '',
                item.type || '',
                item.isPrimaryMeterRegion ? 'Yes' : 'No',
                item.armSkuName || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`);
            
            csvContent += row.join(',') + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'azure-retail-prices.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Fetch data from the API
    function fetchData(url, resetTable) {
        $('#loadingSpinner').style.display = 'inline-block';
        $('#searchBtn').disabled = true;
        $('#loadMoreBtn').style.display = 'none';
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                nextPageLink = data.NextPageLink || null;
                const items = data.Items || [];
                
                renderTable(items, resetTable);
                
                // Show the load more button if there are more pages
                if (nextPageLink) {
                    $('#loadMoreBtn').style.display = 'inline-block';
                }
            })
            .catch(err => {
                console.error(err);
                alert(`Failed to retrieve data: ${err.message}`);
            })
            .finally(() => {
                $('#loadingSpinner').style.display = 'none';
                $('#searchBtn').disabled = false;
            });
    }

    // Handler for the search button
    function executeSearch() {
        const filterQuery = buildFilterQuery();
        if (filterQuery === null) {
            alert('Please complete all filter conditions.');
            return;
        }
        const url = constructApiUrl(filterQuery);
        nextPageLink = null;
        fetchData(url, true);
    }

    // Handler for the load more button
    function loadMore() {
        if (nextPageLink) {
            fetchData(nextPageLink, false);
        }
    }

    // Add export button after the results table
    function addExportButton() {
        const exportContainer = document.createElement('div');
        exportContainer.className = 'd-flex justify-content-between align-items-center mb-2';
        exportContainer.style.marginTop = '1rem';
        
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-success btn-sm';
        exportBtn.textContent = 'Export CSV';
        exportBtn.addEventListener('click', exportToCsv);
        
        exportContainer.appendChild(exportBtn);
        $('#resultsSection').appendChild(exportContainer);
    }

    // Initialize the page
    addFilterRow();
    addExportButton();

    // Event listeners
    $('#addFilterBtn').addEventListener('click', function() {
        addFilterRow();
        updateConnectorVisibility();
    });
    
    $('#searchBtn').addEventListener('click', executeSearch);
    $('#loadMoreBtn').addEventListener('click', loadMore);
});