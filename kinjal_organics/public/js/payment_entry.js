frappe.ui.form.on('Payment Entry', {
    onload: function (frm) {
        let user = frappe.session.user;
        if (user === 'rutika@sanskartechnolab.com' && frm.is_new()) { 
            frm.set_value('payment_type', 'Pay');
            frm.set_df_property('payment_type', 'read_only', 1);
        }
    }
});
