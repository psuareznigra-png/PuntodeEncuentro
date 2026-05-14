const fs = require('fs');
const path = require('path');

const appPath = 'app.js';
const blockPath = 'app_restoration_block.js';

let content = fs.readFileSync(appPath, 'utf8').split('\n');
// Truncate at line 2724 (index 2723)
content = content.slice(0, 2723);

// Add missing closing tags for renderAnnouncementsAdmin
content.push('                            <button class="btn btn-ghost btn-sm text-overdue" onclick="window.deleteAnnouncement(\'${a.id}\')">');
content.push('                                <i data-lucide="trash-2"></i>');
content.push('                            </button>');
content.push('                        </div>');
content.push('                    </div>`).join(\'\')');
content.push('        }');
content.push('            </div>');
content.push('        </div>');
content.push('        </div>');
content.push('    `;');
content.push('    window.refreshIcons();');
content.push('}');

// Add the restoration block
const block = fs.readFileSync(blockPath, 'utf8');
const finalContent = content.join('\n') + '\n' + block;

fs.writeFileSync('app_fixed.js', finalContent);
console.log('Fixed file created as app_fixed.js');
