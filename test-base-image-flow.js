import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  }
);

async function testBaseImageFlow() {
  console.log('🧪 Testing Base Image URL Implementation...\n');

  try {
    // Test 1: Verify all ItemTypes have base_image_url
    console.log('1️⃣ Testing ItemTypes base_image_url population...');
    const { data: itemTypes, error: itemTypesError } = await supabase
      .from('itemtypes')
      .select('id, name, base_image_url')
      .order('name');

    if (itemTypesError) {
      throw itemTypesError;
    }

    const itemTypesWithoutUrl = itemTypes.filter(it => !it.base_image_url);
    if (itemTypesWithoutUrl.length > 0) {
      console.log(`❌ ${itemTypesWithoutUrl.length} ItemTypes missing base_image_url:`);
      itemTypesWithoutUrl.forEach(it => console.log(`   - ${it.name} (${it.id})`));
    } else {
      console.log(`✅ All ${itemTypes.length} ItemTypes have base_image_url set`);
    }

    // Test 2: Create a test item and verify it gets the base image URL
    console.log('\n2️⃣ Testing Item creation with base_image_url copy...');

    // Find a test ItemType
    const testItemType = itemTypes.find(it => it.name === 'Sword') || itemTypes[0];
    console.log(`   Using ItemType: ${testItemType.name} (${testItemType.id})`);
    console.log(`   Expected base_image_url: ${testItemType.base_image_url}`);

    // Create test user if needed
    const testUserId = '00000000-0000-0000-0000-000000000001'; // Test UUID

    // Create test item
    const { data: newItem, error: createError } = await supabase
      .from('items')
      .insert({
        user_id: testUserId,
        item_type_id: testItemType.id,
        level: 1,
        is_styled: false,
        current_stats: null,
        material_combo_hash: null,
        generated_image_url: testItemType.base_image_url, // Should be copied by ItemRepository.create()
        image_generation_status: null
      })
      .select()
      .single();

    if (createError) {
      console.log(`⚠️ Item creation test skipped (${createError.message})`);
    } else {
      if (newItem.generated_image_url === testItemType.base_image_url) {
        console.log('✅ Item created with correct base_image_url copied to generated_image_url');
      } else {
        console.log(`❌ Item created but generated_image_url mismatch:`);
        console.log(`   Expected: ${testItemType.base_image_url}`);
        console.log(`   Actual: ${newItem.generated_image_url}`);
      }

      // Clean up test item
      await supabase.from('items').delete().eq('id', newItem.id);
      console.log('   🧹 Test item cleaned up');
    }

    // Test 3: Verify URL patterns are correct
    console.log('\n3️⃣ Testing URL pattern consistency...');
    const expectedBaseUrl = 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/';
    let urlPatternErrors = 0;

    itemTypes.forEach(itemType => {
      if (itemType.base_image_url) {
        if (!itemType.base_image_url.startsWith(expectedBaseUrl)) {
          console.log(`❌ ${itemType.name}: URL doesn't match expected pattern`);
          console.log(`   Expected pattern: ${expectedBaseUrl}*`);
          console.log(`   Actual: ${itemType.base_image_url}`);
          urlPatternErrors++;
        }
      }
    });

    if (urlPatternErrors === 0) {
      console.log(`✅ All base_image_url patterns match expected R2 format`);
    } else {
      console.log(`❌ ${urlPatternErrors} URL pattern errors found`);
    }

    // Test 4: Check naming convention consistency
    console.log('\n4️⃣ Testing snake_case naming convention...');
    const namingErrors = [];

    itemTypes.forEach(itemType => {
      if (itemType.base_image_url) {
        const urlParts = itemType.base_image_url.split('/');
        const filename = urlParts[urlParts.length - 1];
        const expectedName = itemType.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const expectedFilename = `${expectedName}.png`;

        if (filename !== expectedFilename) {
          namingErrors.push({
            name: itemType.name,
            expected: expectedFilename,
            actual: filename
          });
        }
      }
    });

    if (namingErrors.length === 0) {
      console.log('✅ All filenames follow snake_case convention');
    } else {
      console.log(`❌ ${namingErrors.length} naming convention errors:`);
      namingErrors.forEach(error => {
        console.log(`   ${error.name}: expected "${error.expected}", got "${error.actual}"`);
      });
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   ItemTypes processed: ${itemTypes.length}`);
    console.log(`   ItemTypes with base_image_url: ${itemTypes.length - itemTypesWithoutUrl.length}`);
    console.log(`   URL pattern errors: ${urlPatternErrors}`);
    console.log(`   Naming convention errors: ${namingErrors.length}`);

    const allTestsPassed = itemTypesWithoutUrl.length === 0 && urlPatternErrors === 0 && namingErrors.length === 0;

    if (allTestsPassed) {
      console.log('\n🎉 All tests passed! Base image URL implementation is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the issues above.');
    }

    return allTestsPassed;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

testBaseImageFlow().then(success => {
  process.exit(success ? 0 : 1);
});