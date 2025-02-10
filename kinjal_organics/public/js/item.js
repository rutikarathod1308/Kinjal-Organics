frappe.ui.form.on("Item", {
    refresh: function(frm) {
        if (frm.doc.item_group === "FINISH GOODS" || frm.doc.item_group === "Raw Material") {
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
        if (frm.doc.item_group === "FINISH GOODS" || frm.doc.item_group === "Raw Material") {
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
