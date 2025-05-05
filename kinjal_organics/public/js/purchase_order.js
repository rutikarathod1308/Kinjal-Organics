frappe.ui.form.on("Purchase Order", {
    before_save: function (frm) {
        frm.doc.items.forEach(item => {
            frappe.model.set_value(item.doctype, item.name, "custom_pending_qty", item.qty);
        });
    },
})

frappe.ui.form.on("Purchase Order", {
    before_save: function (frm) {
        frm.doc.items.forEach(item => {
            frappe.model.set_value(item.doctype, item.name, "custom_pending_qty", item.qty);
        });
    },
})

frappe.ui.form.on("Purchase Order", {
    refresh: function (frm) {
        if (frm.doc.workflow_state === "Re-Approve") {
            

            // Clear the entire 'Create' dropdown menu
            frm.page.clear_menu();

            // Try removing custom buttons (if any were added)
            frm.remove_custom_button('Update Items');
            
            // Hide standard buttons via jQuery if needed (risky, not recommended for long term)
            setTimeout(() => {
                $("button:contains('Update Items')").hide();
                $("button:contains('Create')").hide();
            }, 100);
        }
    }
});



