/*
 * Azure Retail Prices Explorer
 *
 * This script powers the interactive search experience on the page.  It lets
 * users compose OData filter expressions by selecting a field, operator and
 * value.  When the user submits the form the script builds a filter string,
 * constructs the request URL with additional options (API version, currency
 * and primary‑meter filter) and fetches data from the Azure Retail Prices
 * API.  It then displays the results in a DataTable with built‑in CSV export
 * functionality.  Pagination is handled client‑side: the API returns
 * NextPageLink when more than 1,000 results match the query.  A “Load more”
 * button appears when there are additional pages and appends new rows to the
 * table without clearing existing data.
 */

$(function () {
    // Available filter fields and operators.  See the API documentation for
    // supported fields【315035420493581†L323-L340】.  The properties here should match
    // the JSON property names returned by the API.
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
    let dataTable = null;

    // Create a new filter row and append it to the container
    function addFilterRow() {
        filterCount++;
        const rowId = `filterRow${filterCount}`;
        const row = $(
            `<div class="filter-row row g-2 align-items-center" data-row-id="${rowId}">
                <div class="col-auto connector-col" ${filterCount === 1 ? 'style="display:none;"' : ''}>
                    <select class="form-select form-select-sm connector-select" aria-label="Connector">
                        ${CONNECTORS.map(op => `<option value="${op.value}">${op.label}</option>`).join('')}
                    </select>
                </div>
                <div class="col-sm-3">
                    <select class="form-select form-select-sm field-select" aria-label="Field">
                        <option value="" disabled selected>Select field</option>
                        ${FILTER_FIELDS.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
                    </select>
                </div>
                <div class="col-sm-3">
                    <select class="form-select form-select-sm operator-select" aria-label="Operator">
                        <option value="" disabled selected>Select operator</option>
                        ${OPERATORS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                    </select>
                </div>
                    <div class="col-sm-4">
                        <input type="text" class="form-control form-control-sm value-input" placeholder="Enter value" aria-label="Value">
                    </div>
                    <div class="col-auto">
                        <button type="button" class="btn btn-outline-danger btn-sm remove-filter-btn" title="Remove condition">
                            &times;
                        </button>
                    </div>
            </div>`
        );
        $('#filterContainer').append(row);
    }

    // Remove a filter row
    $('#filterContainer').on('click', '.remove-filter-btn', function () {
        const row = $(this).closest('.filter-row');
        row.remove();
        // Recompute visibility of connector columns
        updateConnectorVisibility();
    });

    // Ensure the first row hides the connector and subsequent rows show it
    function updateConnectorVisibility() {
        const rows = $('#filterContainer .filter-row');
        rows.each(function (index) {
            if (index === 0) {
                $(this).find('.connector-col').hide();
            } else {
                $(this).find('.connector-col').show();
            }
        });
    }

    // Build an OData filter expression from the UI
    function buildFilterQuery() {
        const rows = $('#filterContainer .filter-row');
        const parts = [];
        let valid = true;
        rows.each(function (index) {
            const field = $(this).find('.field-select').val();
            const operator = $(this).find('.operator-select').val();
            const value = $(this).find('.value-input').val().trim();
            const connector = index > 0 ? $(this).find('.connector-select').val() : '';
            if (!field || !operator || !value) {
                valid = false;
                return false; // break early
            }
            // Escape single quotes in the value for OData compliance
            const escapedValue = value.replace(/'/g, "''");
            let expression;
            if (operator === 'eq' || operator === 'ne') {
                expression = `${field} ${operator} '${escapedValue}'`;
            } else if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
                expression = `${operator}(${field}, '${escapedValue}')`;
            } else {
                // unknown operator
                valid = false;
                return false;
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
        const baseUrl = 'https://prices.azure.com/api/retail/prices';
        const params = [];
        if (filterQuery) {
            params.push(`$filter=${encodeURIComponent(filterQuery)}`);
        }
        const apiVersion = $('#apiVersionSelect').val();
        if (apiVersion) {
            params.push(`api-version=${encodeURIComponent(apiVersion)}`);
        }
        const currency = $('#currencySelect').val();
        if (currency) {
            params.push(`currencyCode=${encodeURIComponent(currency)}`);
        }
        if ($('#primaryOnlyCheck').prop('checked')) {
            // The API uses meterRegion=primary to retrieve only primary meters【315035420493581†L90-L97】.
            params.push('meterRegion=primary');
        }
        return params.length ? `${baseUrl}?${params.join('&')}` : baseUrl;
    }

    // Fetch data from the API and populate the DataTable
    function fetchData(url, resetTable) {
        $('#loadingSpinner').show();
        $('#searchBtn').prop('disabled', true);
        $('#loadMoreBtn').hide();
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
                const rows = items.map(item => [
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
                ]);
                if (resetTable) {
                    // Create or reset the DataTable
                    if (dataTable) {
                        dataTable.clear();
                        dataTable.rows.add(rows).draw();
                    } else {
                        dataTable = $('#resultsTable').DataTable({
                            data: rows,
                            // Defer to DataTables to infer column titles from the thead markup
                            deferRender: true,
                            scrollX: true,
                            pageLength: 25,
                            lengthMenu: [10, 25, 50, 100],
                            dom: 'Bfrtip',
                            buttons: [
                                {
                                    extend: 'csvHtml5',
                                    text: 'Export CSV',
                                    className: 'btn btn-success btn-sm',
                                    filename: 'azure-retail-prices',
                                    exportOptions: {
                                        columns: ':visible'
                                    }
                                },
                                {
                                    extend: 'colvis',
                                    text: 'Columns',
                                    className: 'btn btn-secondary btn-sm'
                                }
                            ]
                        });
                    }
                    $('#resultsSection').show();
                } else {
                    // Append rows to existing table
                    dataTable.rows.add(rows).draw();
                }
                // Show the load more button if there are more pages
                if (nextPageLink) {
                    $('#loadMoreBtn').show();
                }
            })
            .catch(err => {
                console.error(err);
                alert(`Failed to retrieve data: ${err.message}`);
            })
            .finally(() => {
                $('#loadingSpinner').hide();
                $('#searchBtn').prop('disabled', false);
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

    // Initialize the page with a single filter row
    addFilterRow();

    // Event listeners
    $('#addFilterBtn').on('click', function () {
        addFilterRow();
        updateConnectorVisibility();
    });
    $('#searchBtn').on('click', function () {
        executeSearch();
    });
    $('#loadMoreBtn').on('click', function () {
        loadMore();
    });
});