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
                return frappe.db.get_link_options("BOM", txt, {
                    docstatus: 1,
                    is_default: 1,
                    is_active: 1
                });
            },
            "on_change": function () {
                frappe.after_ajax(() => {
                    let selected_boms = frappe.query_report.get_filter_value("bom") || [];
                    console.log("Selected BOMs:", selected_boms);  

                    if (selected_boms.length > 0) {
                        let quantities = [];

                        let fetchBOMQuantity = function (index) {
                            if (index >= selected_boms.length) {
                                let final_qty = quantities.join(", "); // Combine quantities with commas
                                frappe.query_report.set_filter_value("qty_to_produce", final_qty || "1");
                                frappe.query_report.refresh();
                                return;
                            }

                            frappe.call({
                                method: "frappe.client.get_value",
                                args: {
                                    doctype: "BOM",
                                    filters: { name: selected_boms[index] },
                                    fieldname: "quantity"
                                },
                                callback: function (r) {
                                    if (r.message) {
                                        console.log(`BOM: ${selected_boms[index]}, Quantity: ${r.message.quantity}`);
                                        quantities.push(r.message.quantity);
                                    } else {
                                        quantities.push("1"); // Default if no quantity found
                                    }
                                    fetchBOMQuantity(index + 1); // Fetch next BOM
                                }
                            });
                        };

                        fetchBOMQuantity(0);
                    } else {
                        frappe.query_report.set_filter_value("qty_to_produce", "1"); // Default value
                        frappe.query_report.refresh();
                    }
                });
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
