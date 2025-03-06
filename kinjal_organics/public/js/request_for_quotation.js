frappe.ui.form.on("Request for Quotation", {
    refresh: function (frm) {
        if(frm.is_new()){
            frm.doc.items.forEach(function (item) {
                if (item.item_code) {
                    frappe.call({
                        method: "frappe.client.get",
                        args: {
                            doctype: "Item",
                            name: item.item_code
                        },
                        callback: function (r) {
                            if (r.message && r.message.supplier_items.length > 0 ) {
                                let suppliers = r.message.supplier_items;
                               
                                // Loop through suppliers and add them to the suppliers table
                                suppliers.forEach(function (supplier_entry) {
                                    if(item.warehouse === supplier_entry.custom_warehouse){
                                       let row = frm.add_child("suppliers");
                                    row.supplier = supplier_entry.supplier;
                                    row.email_id = supplier_entry.custom_email_id
                                    row.custom_city = supplier_entry.custom_city,
                                    row.custom_warehouse = supplier_entry.custom_warehouse
                                    }
                                 
                                   
                                });
                                
                                // Refresh the field to show added suppliers
                                frm.refresh_field("suppliers");
                            }
                        }
                    });
                }
            });
            frm.clear_table("suppliers");
        }
        // Ensure that the suppliers table is empty before adding new suppliers
      

        // Loop through each item in the child table
        
    }
});
