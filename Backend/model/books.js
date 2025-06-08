const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Book title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  author: {
    type: String,
    required: [true, 'Author is required'],
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters']
  },
  isbn: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/, 'Please enter a valid ISBN']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  genre: [{
    type: String,
    trim: true,
    enum: [
      'Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Science Fiction',
      'Fantasy', 'Biography', 'History', 'Self-Help', 'Business',
      'Technology', 'Health', 'Travel', 'Cooking', 'Art', 'Religion',
      'Philosophy', 'Poetry', 'Drama', 'Children', 'Young Adult'
    ]
  }],
  language: {
    type: String,
    default: 'English',
    trim: true
  },
  publishedDate: {
    type: Date
  },
  publisher: {
    type: String,
    trim: true,
    maxlength: [100, 'Publisher name cannot exceed 100 characters']
  },
  pageCount: {
    type: Number,
    min: [1, 'Page count must be at least 1']
  },
  coverImage: {
    type: String,
    default: null
  },
  pdfFile: {
    type: String,
    default: null
  },
  availability: {
    type: String,
    enum: ['available', 'borrowed', 'reserved', 'maintenance'],
    default: 'available'
  },
  totalCopies: {
    type: Number,
    default: 1,
    min: [0, 'Total copies cannot be negative']
  },
  availableCopies: {
    type: Number,
    default: 1,
    min: [0, 'Available copies cannot be negative']
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  borrowHistory: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    borrowDate: {
      type: Date,
      default: Date.now
    },
    returnDate: {
      type: Date
    },
    dueDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['borrowed', 'returned', 'overdue'],
      default: 'borrowed'
    }
  }],
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [500, 'Review comment cannot exceed 500 characters']
    },
    date: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for search functionality
bookSchema.index({ title: 'text', author: 'text', description: 'text' });
bookSchema.index({ genre: 1 });
bookSchema.index({ availability: 1 });
bookSchema.index({ 'rating.average': -1 });

// Virtual for full title with author
bookSchema.virtual('fullTitle').get(function() {
  return `${this.title} by ${this.author}`;
});

// Method to check if book is available for borrowing
bookSchema.methods.isAvailable = function() {
  return this.availability === 'available' && this.availableCopies > 0;
};

// Method to borrow book
bookSchema.methods.borrowBook = function(userId) {
  if (!this.isAvailable()) {
    throw new Error('Book is not available for borrowing');
  }
  
  this.availableCopies -= 1;
  if (this.availableCopies === 0) {
    this.availability = 'borrowed';
  }
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14); // 2 weeks borrowing period
  
  this.borrowHistory.push({
    user: userId,
    dueDate: dueDate,
    status: 'borrowed'
  });
  
  return this.save();
};

// Method to return book
bookSchema.methods.returnBook = function(userId) {
  const borrowRecord = this.borrowHistory.find(
    record => record.user.toString() === userId.toString() && record.status === 'borrowed'
  );
  
  if (!borrowRecord) {
    throw new Error('No active borrow record found for this user');
  }
  
  borrowRecord.returnDate = new Date();
  borrowRecord.status = 'returned';
  
  this.availableCopies += 1;
  if (this.availableCopies > 0) {
    this.availability = 'available';
  }
  
  return this.save();
};

// Static method to find available books
bookSchema.statics.findAvailable = function() {
  return this.find({ availability: 'available', availableCopies: { $gt: 0 } });
};

// Static method to search books
bookSchema.statics.searchBooks = function(query) {
  return this.find({
    $text: { $search: query }
  }).sort({ score: { $meta: 'textScore' } });
};

module.exports = mongoose.model('Book', bookSchema);