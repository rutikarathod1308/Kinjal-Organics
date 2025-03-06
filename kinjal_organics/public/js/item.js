frappe.ui.form.on("Item", {
    refresh: function(frm) {
        if (frm.doc.item_group === "FINISH GOODS" || frm.doc.item_group === "RAW MATERIAL") {
            frm.fields_dict['reorder_levels'].df.reqd = 1;
            frm.fields_dict['valuation_method'].df.reqd = 1; // Make reorder_levels mandatory
            frm.refresh_field('reorder_levels');
            frm.refresh_field('valuation_method');
        } else {
            frm.fields_dict['reorder_levels'].df.reqd = 0; // Make reorder_levels not mandatory
            frm.fields_dict['valuation_method'].df.reqd = 0; // Make reorder_levels not mandatory
            frm.refresh_field('reorder_levels');
            frm.refresh_field('valuation_method');
        }
    },
    item_group: function(frm) {
        if (frm.doc.item_group === "FINISH GOODS" || frm.doc.item_group === "RAW MATERIAL") {
            frm.fields_dict['reorder_levels'].df.reqd = 1;
            frm.fields_dict['valuation_method'].df.reqd = 1; // Make reorder_levels mandatory
            frm.refresh_field('reorder_levels');
            frm.refresh_field('valuation_method');
        } else {
            frm.fields_dict['reorder_levels'].df.reqd = 0;
            frm.fields_dict['valuation_method'].df.reqd = 0; // Make reorder_levels not mandatory
            frm.refresh_field('reorder_levels');
            frm.refresh_field('valuation_method');
        }
    }
});

frappe.ui.form.on("Item Supplier", {
    supplier: function(frm, cdt, cdn) {
        var d = locals[cdt][cdn];

        if (d.supplier) {
            frappe.call({
                method: "kinjal_organics.public.py.item.get_supplier_address",  // Update with your actual app path
                args: {
                    supplier: d.supplier
                },
                callback: function(response) {
               
                        console.log(response.message); 
                        frappe.model.set_value(d.doctype, d.name, "custom_email_id", response.message);
                    
                }
            });
        }
    }
});

