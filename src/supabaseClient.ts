import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rxxurupupsfofpfqxuco.supabase.co';
const supabaseKey = 'sb_publishable_XQGXPFoSDj5NvAGQ03FGaw_CaufYw2g';

export const supabase = createClient(supabaseUrl, supabaseKey);
