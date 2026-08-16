<?php
// app/Models/MessageAttachment.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class MessageAttachment extends Model
{
    use HasFactory;

    protected $fillable = ['message_id', 'disk', 'path', 'original_name', 'mime_type', 'size'];


    public function message()
    {
        return $this->belongsTo(Message::class);
    }

    public function url(): string
    {
        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk($this->disk);

        return $disk->url($this->path);
    }

    /** image | video | pdf | file — drives which preview the frontend renders */
    public function kind(): string
    {
        return match (true) {
            str_starts_with($this->mime_type, 'image/') => 'image',
            str_starts_with($this->mime_type, 'video/') => 'video',
            str_starts_with($this->mime_type, 'audio/') => 'audio',
            $this->mime_type === 'application/pdf' => 'pdf',
            default => 'file',
        };
    }
}
