frappe.ui.form.on("Sales Order", {
    before_save: function (frm) {
        frm.doc.items.forEach(item => {
            frappe.model.set_value(item.doctype, item.name, "custom_pending_qty", item.qty);
        });
    }
});


frappe.ui.form.on("Sales Order", {
    onload: function (frm) {
        if (frm.doc.workflow_state === "Re-Approve") {
            
            $("button:contains('Update Items')").hide();
            $("button:contains('Create')").hide();
        }
    }
});
