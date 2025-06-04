frappe.listview_settings["Request for Quotation"] = {
    get_indicator: function (doc) {
        if (doc.status == "Received") {
            return [__("Received"), "green", "status,=,Received"];
            
        }
        else if (doc.status == "Partially Received") {
            return [__("Partially Received"), "orange", "status,=,Partially Received"];
            
        }
        else if (doc.status == "Draft") {
            return [__("Draft"), "red", "status,=,Draft"];
           
        }
        else if (doc.status == "Submitted") {
            return [__("Submitted"), "blue", "status,=,Submitted"];
            
        }
    }
}
