frappe.ui.form.on("Request for Quotation", {
    refresh: function (frm) {
        if (frm.is_new()) {
            let supplierMap = {}; // Object to track suppliers by city and warehouses

            frm.clear_table("suppliers"); // Clear the table before adding new entries

            frm.doc.items.forEach(function (item) {
                if (item.item_code) {
                    frappe.call({
                        method: "frappe.client.get",
                        args: {
                            doctype: "Item",
                            name: item.item_code
                        },
                        callback: function (r) {
                            if (r.message && r.message.supplier_items.length > 0) {
                                let suppliers = r.message.supplier_items;

                                // Loop through suppliers and add/update them in the suppliers table
                                suppliers.forEach(function (supplier_entry) {
                                    if (item.warehouse === supplier_entry.custom_warehouse) {
                                        let supplierKey = supplier_entry.supplier  // Unique key based on supplier 

                                        if (supplierMap[supplierKey]) {
                                            // Append warehouse if supplier+city already exists
                                            if (!supplierMap[supplierKey].warehouses.includes(supplier_entry.custom_warehouse)) {
                                                supplierMap[supplierKey].warehouses.push(supplier_entry.custom_warehouse);
                                            }
                                        } else {
                                            // Create a new supplier entry
                                            supplierMap[supplierKey] = {
                                                supplier: supplier_entry.supplier,
                                                email_id: supplier_entry.custom_email_id,
                                                custom_city: supplier_entry.custom_city,
                                                warehouses: [supplier_entry.custom_warehouse]
                                            };
                                        }
                                    }
                                });

                                // Populate the suppliers table with combined warehouse names
                                frm.clear_table("suppliers");
                                Object.values(supplierMap).forEach((supplierData) => {
                                    let row = frm.add_child("suppliers");
                                    row.supplier = supplierData.supplier;
                                    row.email_id = supplierData.email_id;
                                    row.custom_city = supplierData.custom_city;
                                    row.custom_warehouse_name = supplierData.warehouses.join(", "); // Combine warehouses
                                });

                                // Refresh the field to show added suppliers
                                frm.refresh_field("suppliers");
                            }
                        }
                    });
                }
                if (item.item_code && item.warehouse) {
                    
                    // Fetch warehouse details to get the city
                    frappe.call({
                        method: "frappe.client.get",
                        args: {
                            doctype: "Warehouse",
                            name: item.warehouse
                        },
                        callback: function (wh) {
                            if (wh.message) {
                                let city = wh.message.city || "";  // Fetch city from warehouse
                                frappe.model.set_value(item.doctype, item.name, "city", city);  // Set city in item table
                            }
                        }
                    });
                }
            });
        
        }
    }
});


frappe.ui.form.on("Request for Quotation Item", "warehouse", function(frm, cdt, cdn) {
    var d = locals[cdt][cdn];  // Get the current row's data
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Warehouse",
            name: d.warehouse
        },
        callback: function(wh) {
            if (wh.message) {
                let city = wh.message.city || "";  // Fetch city from warehouse
                frappe.model.set_value(d.doctype, d.name, "city", city);  // Set city in item table
            }
        }
    });
});
