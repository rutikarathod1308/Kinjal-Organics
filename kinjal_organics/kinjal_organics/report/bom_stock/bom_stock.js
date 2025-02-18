frappe.query_reports["Bom Stock"] = {
    filters: [
        {
            fieldname: "bom",
            label: __("BOM"),
            fieldtype: "MultiSelectList",
            width: "80",
            options: "BOM",
            reqd: 1,
            get_data: function (txt) {
                return frappe.db.get_link_options("BOM", txt);
            },
            get_query: function () {
                return {
                    filters: { 
                        docstatus: 1,
                        is_default: 1  // Apply filter for default BOMs
                    }
                };
            }
        },
        {
            fieldname: "warehouse",
            label: __("Warehouse"),
            fieldtype: "Link",
            options: "Warehouse",
            reqd: 1,
        },
        {
            fieldname: "show_exploded_view",
            label: __("Show exploded view"),
            fieldtype: "Check",
        },
        {
            fieldname: "qty_to_produce",
            label: __("Quantity to Produce"),
            fieldtype: "Data",
            default: "1",
        },
    ],
    
    formatter: function (value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);

        // Handle item column formatting with color based on stock status
        if (column.id == "item") {
            if (data["in_stock_qty"] >= data["required_qty"]) {
                value = `<a style='color:green' href="/app/item/${data["item"]}" data-doctype="Item">${data["item"]}</a>`;
            } else {
                value = `<a style='color:red' href="/app/item/${data["item"]}" data-doctype="Item">${data["item"]}</a>`;
            }
        }
        return value;
    },
};
