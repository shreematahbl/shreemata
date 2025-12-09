/**
 * GridFS Upload (MongoDB)
 * This uploads images to our server which stores them in MongoDB GridFS
 */

/**
 * Upload file to GridFS
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - The uploaded image URL
 */
async function uploadToGridFS(file) {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error('Authentication required');
    }

    console.log('📤 Uploading to GridFS:', file.name);

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`${window.API_URL}/upload/image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Upload error:', errorData);
            throw new Error(`Upload failed: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Upload successful:', data.url);
        return data.url;
    } catch (error) {
        console.error('❌ Upload error:', error);
        throw error;
    }
}

/**
 * Upload multiple files to GridFS
 * @param {FileList} files - The files to upload
 * @returns {Promise<string[]>} - Array of uploaded image URLs
 */
async function uploadMultipleToGridFS(files) {
    const uploadPromises = Array.from(files).map(file => uploadToGridFS(file));
    return Promise.all(uploadPromises);
}

// Export functions (keeping same interface for compatibility)
window.cloudinaryUpload = {
    uploadToCloudinary: uploadToGridFS,
    uploadMultipleToCloudinary: uploadMultipleToGridFS
};
