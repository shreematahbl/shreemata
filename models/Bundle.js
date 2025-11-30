// models/Bundle.js
const mongoose = require("mongoose");

const bundleSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    
    description: { 
        type: String 
    },
    
    books: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
        required: true
    }],
    
    originalPrice: { 
        type: Number, 
        required: true 
    },
    
    bundlePrice: { 
        type: Number, 
        required: true 
    },
    
    discount: { 
        type: Number // Percentage discount
    },
    
    isActive: { 
        type: Boolean, 
        default: true 
    },
    
    image: { 
        type: String // Bundle cover image
    },
    
    validUntil: { 
        type: Date // Optional expiry date
    }

}, { timestamps: true });

// Calculate discount percentage before saving
bundleSchema.pre('save', function(next) {
    if (this.originalPrice && this.bundlePrice) {
        this.discount = Math.round(((this.originalPrice - this.bundlePrice) / this.originalPrice) * 100);
    }
    next();
});

module.exports = mongoose.model("Bundle", bundleSchema);
