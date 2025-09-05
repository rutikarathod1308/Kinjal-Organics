frappe.listview_settings["Supplier Quotation"] = {
    get_indicator: function (doc) {
        if (doc.status == "Ordered") {
            return [__("Ordered"), "green", "status,=,Ordered"];
        } else if (doc.status == "Partially Ordered") {
            return [__("Partially Ordered"), "orange", "status,=,Partially Ordered"];
        }
    }
};
