<?php // database/migrations/2026_08_10_000000_add_group_fields_to_conversations_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->boolean('is_group')->default(false)->after('user_two_id');
            $table->string('name')->nullable()->after('is_group');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete()->after('name');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('user_one_id')->nullable()->change();
            $table->foreignId('user_two_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn(['is_group', 'name']);
        });
    }
};