const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required for annotation']
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: [true, 'Book is required for annotation']
  },
  type: {
    type: String,
    enum: ['highlight', 'note', 'bookmark', 'comment'],
    required: [true, 'Annotation type is required']
  },
  content: {
    selectedText: {
      type: String,
      trim: true,
      maxlength: [1000, 'Selected text cannot exceed 1000 characters']
    },
    userNote: {
      type: String,
      trim: true,
      maxlength: [2000, 'User note cannot exceed 2000 characters']
    }
  },
  position: {
    page: {
      type: Number,
      required: [true, 'Page number is required'],
      min: [1, 'Page number must be at least 1']
    },
    startOffset: {
      type: Number,
      min: [0, 'Start offset cannot be negative']
    },
    endOffset: {
      type: Number,
      min: [0, 'End offset cannot be negative']
    },
    coordinates: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    }
  },
  color: {
    type: String,
    default: '#ffff00', // Default yellow highlight
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid hex color']
  },
  isPrivate: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  replies: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Reply cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
annotationSchema.index({ user: 1, book: 1 });
annotationSchema.index({ book: 1, 'position.page': 1 });
annotationSchema.index({ type: 1 });
annotationSchema.index({ isPrivate: 1 });
annotationSchema.index({ createdAt: -1 });

// Middleware to update lastModified on save
annotationSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModified = new Date();
  }
  next();
});

// Virtual for like count
annotationSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for reply count
annotationSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Method to check if user has liked the annotation
annotationSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to toggle like
annotationSchema.methods.toggleLike = function(userId) {
  const existingLikeIndex = this.likes.findIndex(
    like => like.user.toString() === userId.toString()
  );
  
  if (existingLikeIndex > -1) {
    // Remove like
    this.likes.splice(existingLikeIndex, 1);
    return { action: 'unliked', likeCount: this.likes.length };
  } else {
    // Add like
    this.likes.push({ user: userId });
    return { action: 'liked', likeCount: this.likes.length };
  }
};

// Method to add reply
annotationSchema.methods.addReply = function(userId, content) {
  this.replies.push({
    user: userId,
    content: content
  });
  return this.save();
};

// Method to soft delete annotation
annotationSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// Static method to find user's annotations for a book
annotationSchema.statics.findUserAnnotations = function(userId, bookId) {
  return this.find({
    user: userId,
    book: bookId,
    isDeleted: false
  }).sort({ 'position.page': 1, createdAt: 1 });
};

// Static method to find public annotations for a book
annotationSchema.statics.findPublicAnnotations = function(bookId) {
  return this.find({
    book: bookId,
    isPrivate: false,
    isDeleted: false
  }).populate('user', 'username firstName lastName profilePicture')
    .sort({ 'position.page': 1, createdAt: 1 });
};

// Static method to find annotations by type
annotationSchema.statics.findByType = function(userId, bookId, type) {
  return this.find({
    user: userId,
    book: bookId,
    type: type,
    isDeleted: false
  }).sort({ 'position.page': 1, createdAt: 1 });
};

// Static method to search annotations by content
annotationSchema.statics.searchAnnotations = function(userId, searchQuery) {
  return this.find({
    user: userId,
    isDeleted: false,
    $or: [
      { 'content.selectedText': { $regex: searchQuery, $options: 'i' } },
      { 'content.userNote': { $regex: searchQuery, $options: 'i' } },
      { tags: { $in: [new RegExp(searchQuery, 'i')] } }
    ]
  }).populate('book', 'title author')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Annotation', annotationSchema);