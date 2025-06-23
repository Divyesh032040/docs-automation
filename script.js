

import clipboard from 'clipboardy';
import { google } from 'googleapis';
import fs from 'fs';

// Load Google Docs API credentials
const CREDENTIALS_PATH = './credentials.json'; // Replace with your credentials file
const DOCUMENT_ID = '1XiPYGXGdtdzeQWN4TxRASkbN8AxNffHtPWXh7_cRBRk'; // Replace with your Google Doc ID

// Authenticate with Google Docs API
const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/documents'],
});

const docs = google.docs({ version: 'v1', auth });

// Append a new text above the existing text
async function appendToGoogleDoc(text) {
    // Fetch the document to get the current length
    const doc = await docs.documents.get({ documentId: DOCUMENT_ID });
    const endIndex = doc.data.body.content.reduce((maxIndex, element) => {
        return element.endIndex ? Math.max(maxIndex, element.endIndex) : maxIndex;
    }, 1);

    const requests = [
        {
            insertText: {
                location: { index: endIndex - 1 }, // Append at the last index
                text: text + '\n',
            },
        },
    ];

    await docs.documents.batchUpdate({
        documentId: DOCUMENT_ID,
        requestBody: { requests },
    });

    console.log('Copied text appended to Google Doc.');
}

// Replace Google Doc content with new text
async function replaceGoogleDocContent(newText) {
    try {
        // Fetch the document to get its content
        const document = await docs.documents.get({ documentId: DOCUMENT_ID });
        const content = document.data.body.content;

        // Calculate the end index of the document content
        const endIndex = content.reduce((maxIndex, element) => {
            return element.endIndex ? Math.max(maxIndex, element.endIndex) : maxIndex;
        }, 1);

        const requests = [];

        // Only add delete request if there is actual content to delete
        const hasContent = content.some(element => 
            element.paragraph && element.paragraph.elements && 
            element.paragraph.elements.some(el => el.textRun && el.textRun.content && el.textRun.content.trim())
        );

        if (hasContent && endIndex > 1) {
            requests.push({
                deleteContentRange: {
                    range: {
                        startIndex: 1,
                        endIndex: endIndex - 1,
                    },
                },
            });
        }

        // Always add insert request for new text
        requests.push({
            insertText: {
                location: { index: 1 },
                text: newText + '\n',
            },
        });

        // Execute the batch update
        await docs.documents.batchUpdate({
            documentId: DOCUMENT_ID,
            requestBody: { requests },
        });

        console.log('Replaced Google Doc content with new text.');
    } catch (err) {
        console.error('Error replacing content:', err.message);
    }
}

// Monitor clipboard for appending new content
let lastTextAppend = clipboard.readSync(); // Initialize with current clipboard content for append
async function monitorClipboardForAppend() {
    console.log('Monitoring clipboard for appending new content...');
    while (true) {
        try {
            const text = clipboard.readSync(); // Read clipboard content
            if (text !== lastTextAppend && text !== '') { // Only act on new, non-empty content
                lastTextAppend = text;
                await appendToGoogleDoc(text); // Append new clipboard content
            }
            await new Promise((resolve) => setTimeout(resolve, 500)); // Poll every 500ms
        } catch (err) {
            console.error('Error in append monitoring:', err.message);
        }
    }
}

// Monitor clipboard for replacing content
let lastTextReplace = clipboard.readSync(); // Initialize with current clipboard content for replace
async function monitorClipboardForReplace() {
    console.log('Monitoring clipboard for replacing content...');
    while (true) {
        try {
            const text = clipboard.readSync(); // Read clipboard content
            if (text !== lastTextReplace && text !== '') { // Only act on new, non-empty content
                lastTextReplace = text;
                await replaceGoogleDocContent(text); // Replace with new clipboard content
            }
            await new Promise((resolve) => setTimeout(resolve, 50)); // Poll every 500ms
        } catch (err) {
            console.error('Error in replace monitoring:', err.message);
        }
    }
}

// Select mode based on command-line argument
const mode = process.argv[2]?.toLowerCase(); // Get the mode from command line (e.g., "append" or "replace")

if (mode === 'a') {
    monitorClipboardForAppend();
} else if (mode === 'r') {
    monitorClipboardForReplace();
} else {
    console.error('Please specify a mode: "nodemon script.js append" or "nodemon script.js replace"');
    process.exit(1);
}